"""Render the landing page's background loop, public/balmoos.mp4, on the GPU.

It is drawn from what fetch.py and points.py left in the cache: a drone's view of the site, about
250 m up and tilted 50 degrees down, gliding slowly in a straight line, its end dissolving into its
start so that it loops.

The scene is the lidar points of the trees and buildings (points.npz), over the 0.5 m ground under
the aerial photo, inside the coarser ground of src/data/surroundings.json under the wider photo.
The points are drawn as surface splats: soft discs whose colours are averaged, by weight, where they
overlap at the front of a crown, so the canopy reads as one shaded surface rather than as dots.
Each frame is recorded the way a camera records one: EXPOSURES moments spread over a shutter open
for half the frame interval are averaged (motion blur), each drawn at SUPERSAMPLE times the output
size and reduced through a Mitchell-Netravali filter, so detail finer than a pixel blends instead
of crawling as the camera moves. The loop is kept near-lossless as master.mp4 in the cache, and the
web video is encoded from it.

    python3 scripts/flyover/render.py [--cache DIR] [--device N] [--out public/balmoos.mp4]
    python3 scripts/flyover/render.py --still 360 frame.png     one frame, to check a change
    python3 scripts/flyover/render.py --altitude 300 --fps 30   to try another camera
    python3 scripts/flyover/render.py --encode-only             re-encode the cached master
    python3 scripts/flyover/render.py --list-devices            the GPUs EGL offers

Needs an EGL-capable GPU driver, ffmpeg, and the Python packages in requirements.txt.
"""

import argparse
import json
import logging
import math
import shutil
import subprocess
import sys
from pathlib import Path

import moderngl
import numpy as np
from area import DATA, DEFAULT_CACHE, FAR, MX0, MY0, ROOT, TRUE_SCALE, mercator
from PIL import Image
from scipy.ndimage import gaussian_filter

Image.MAX_IMAGE_PIXELS = None
Array = np.ndarray
log = logging.getLogger("render")
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"

WIDTH, HEIGHT, FPS = 1920, 1080, 60
# Each output pixel weighs the render's texels within two output pixels of it by the
# Mitchell-Netravali filter. Against a plain average of a 2 x 2 block it let less sub-pixel detail
# alias into patterns that crawl as the camera moves: at 3x, the near-lossless master came out at
# half the size, and the web video at the same quality setting 13% smaller and scoring higher.
SUPERSAMPLE, EXPOSURES = 3, 6
SHUTTER = 0.5  # of the frame interval, as a camera's 180 degree shutter: 1/60 s at 30 fps
# The camera: height above the ground at the site (m), tilt below the horizon and horizontal field
# of view (degrees), the latter a drone's wide lens.
ALTITUDE, PITCH, HFOV = 250.0, 50.0, 73.0
VFOV = 2 * math.degrees(math.atan(math.tan(math.radians(HFOV / 2)) * HEIGHT / WIDTH))
# The flight: one straight glide over the site at a constant speed, facing north throughout, along
# BEARING (degrees from north) at SPEED, a fraction of the frame's width on the ground a second.
# Changes of direction, turning and zooming are what make moving pictures sickening, so it does none
# of them. It loops without turning back: its last CROSSFADE seconds dissolve into its first.
BEARING, SPEED = 75.0, 0.012
SECONDS, CROSSFADE = 15, 3
# The ground under a canopy taller than CANOPY_CLEARANCE (m) is shaded, fully under CANOPY_FULL_SHADE,
# when it is darkened by CANOPY_SHADE.
CANOPY_CLEARANCE, CANOPY_FULL_SHADE, CANOPY_SHADE = 1.5, 6.0, 0.3
# The splats: discs SPLAT_SIZE metres across, their weight falling off from the centre as
# exp(-SPLAT_FALLOFF r^2); those within SPLAT_DEPTH metres behind the nearest at a pixel are averaged.
# A pixel is all canopy once the weights there add up to SPLAT_COVER, and fades to the ground below.
SPLAT_SIZE, SPLAT_FALLOFF, SPLAT_DEPTH, SPLAT_COVER = 0.8, 3.0, 1.0, 0.8
# The part of a splat's radius that hides what lies behind it.
SPLAT_CORE = 0.5
# The air between the camera and what it sees: its colour and the distance it thickens over (m).
HAZE, HAZE_DISTANCE = (0.72, 0.77, 0.83), 4000.0
# The web video: H.264, which every browser plays, at WEB_MEGABYTES, encoded in two passes to land on
# that size. The settings were chosen by encoding the master each way and scoring it with VMAF as the
# landing page shows it: scaled to 1920x1080, at the page's video opacity (0.55, Landing.css) over its
# background, under its veil, against the master treated alike. At that opacity 1280x720 at 2.7 MB
# scored as high as the 30 s loop at 8 MB did at full opacity; lower resolutions blur where higher
# ones block at these sizes. One keyframe for the whole loop, which never seeks, saved 12%; level 4.2
# is the one every 1080p60 decoder takes, for 1%; aq-mode 3 keeps the dark canopy from blocking;
# tune film scored higher. The poster, the loop's first frame, shows until the video plays.
WEB_WIDTH, WEB_HEIGHT, WEB_MEGABYTES = 1280, 720, 2.7
POSTER_QUALITY = 8  # ffmpeg's JPEG scale, 2 (best) to 31
WEB_ENCODE = [
    "-vf", f"scale={WEB_WIDTH}:{WEB_HEIGHT}:flags=lanczos",
    "-c:v", "libx264", "-preset", "veryslow", "-tune", "film", "-level:v", "4.2",
    "-pix_fmt", "yuv420p", "-an",
]  # fmt: skip
MASTER = ["-c:v", "libx264", "-preset", "fast", "-crf", "6", "-pix_fmt", "yuv420p", "-an"]

MESH_VERTEX = """
    #version 330
    uniform mat4 mvp;
    in vec3 pos; in vec2 uv; in float shade;
    out vec2 v_uv; out vec3 v_pos; out float v_shade;
    void main() { v_uv = uv; v_pos = pos; v_shade = shade; gl_Position = mvp * vec4(pos, 1.0); }
"""
MESH_FRAGMENT = """
    #version 330
    uniform sampler2D tex;
    uniform vec3 cam;
    uniform vec4 hole;
    uniform bool cut;
    uniform vec3 haze;
    uniform float haze_distance;
    uniform float canopy_shade;
    in vec2 v_uv; in vec3 v_pos; in float v_shade;
    out vec4 color;
    void main() {
        if (cut && v_pos.x > hole.x && v_pos.y > hole.y && v_pos.x < hole.z && v_pos.y < hole.w) discard;
        vec3 c = texture(tex, v_uv).rgb * (1.0 - canopy_shade * v_shade);
        color = vec4(mix(c, haze, 1.0 - exp(-distance(cam, v_pos) / haze_distance)), 1.0);
    }
"""
POINT_VERTEX = """
    #version 330
    uniform mat4 mvp;
    uniform vec3 cam;
    uniform float scale;
    uniform float size;
    uniform float push;
    in vec3 pos; in vec3 col;
    out vec3 v_col; out vec3 v_pos;
    void main() {
        v_col = col; v_pos = pos;
        // The depth pass pushes each point away from the camera along its line of sight, which keeps
        // it on the same pixels, so all the points of the nearest surface pass the colour pass's
        // depth test, not only the single nearest one.
        gl_Position = mvp * vec4(pos + normalize(pos - cam) * push, 1.0);
        gl_PointSize = max(1.0, size * scale / (mvp * vec4(pos, 1.0)).w);
    }
"""
POINT_DEPTH_FRAGMENT = """
    #version 330
    uniform float core;
    out vec4 color;
    void main() {
        // Only a disc's core hides what lies behind it: its faint rim adds too little colour to
        // cover a pixel, and would leave a dark outline where it hid the crown behind.
        if (length(gl_PointCoord - 0.5) * 2.0 > core) discard;
        color = vec4(0.0);
    }
"""
SPLAT_FRAGMENT = """
    #version 330
    uniform vec3 cam;
    uniform vec3 haze;
    uniform float haze_distance;
    uniform float falloff;
    in vec3 v_col; in vec3 v_pos;
    out vec4 color;
    void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float w = exp(-falloff * r * r);
        vec3 c = mix(v_col, haze, 1.0 - exp(-distance(cam, v_pos) / haze_distance));
        color = vec4(c * w, w);
    }
"""
COMPOSITE_FRAGMENT = """
    #version 330
    uniform sampler2D scene;
    uniform sampler2D splats;
    uniform float cover;
    out vec4 color;
    void main() {
        ivec2 p = ivec2(gl_FragCoord.xy);
        vec3 ground = texelFetch(scene, p, 0).rgb;
        vec4 s = texelFetch(splats, p, 0);
        vec3 canopy = s.a > 0.0 ? s.rgb / s.a : ground;
        color = vec4(mix(ground, canopy, clamp(s.a / cover, 0.0, 1.0)), 1.0);
    }
"""
FULLSCREEN_VERTEX = """
    #version 330
    void main() {
        vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }
"""
REDUCE_FRAGMENT = """
    #version 330
    uniform sampler2D src;
    uniform int ss;
    uniform float weight;
    out vec4 color;

    // The Mitchell-Netravali filter with B = C = 1/3, over two output pixels either side.
    float mitchell(float x) {
        const float B = 1.0 / 3.0, C = 1.0 / 3.0;
        x = abs(x);
        if (x < 1.0)
            return ((12.0 - 9.0 * B - 6.0 * C) * x * x * x + (-18.0 + 12.0 * B + 6.0 * C) * x * x
                    + (6.0 - 2.0 * B)) / 6.0;
        if (x < 2.0)
            return ((-B - 6.0 * C) * x * x * x + (6.0 * B + 30.0 * C) * x * x + (-12.0 * B - 48.0 * C) * x
                    + (8.0 * B + 24.0 * C)) / 6.0;
        return 0.0;
    }

    void main() {
        // The output pixel's centre in render texels, whose own centres sit at i + 0.5.
        vec2 centre = gl_FragCoord.xy * float(ss);
        ivec2 lo = ivec2(floor(centre - 2.0 * float(ss)));
        ivec2 hi = ivec2(ceil(centre + 2.0 * float(ss)));
        ivec2 last = textureSize(src, 0) - 1;
        vec3 c = vec3(0.0);
        float total = 0.0;
        for (int y = lo.y; y <= hi.y; y++)
            for (int x = lo.x; x <= hi.x; x++) {
                vec2 d = (vec2(x, y) + 0.5 - centre) / float(ss);
                float w = mitchell(d.x) * mitchell(d.y);
                c += texelFetch(src, clamp(ivec2(x, y), ivec2(0), last), 0).rgb * w;
                total += w;
            }
        color = vec4(c / total * weight, 1.0);
    }
"""


def local(mx: Array | float, my: Array | float) -> tuple[Array | float, Array | float]:
    """Turn Web Mercator metres into true metres east and north of the site centre."""
    return (mx - MX0) * TRUE_SCALE, (my - MY0) * TRUE_SCALE


def grid_mesh(xs: Array, ys: Array, heights: Array, bounds: tuple, shade: Array) -> tuple[Array, Array]:
    """Build the vertices (east, north, height, u, v, shade) and triangles of a height grid, rows from the north."""
    west, south, east, north = bounds
    mx, my = np.meshgrid(xs, ys)
    e, n = local(mx, my)
    u, v = (mx - west) / (east - west), (north - my) / (north - south)
    verts = np.stack([e, n, heights, u, v, shade], axis=-1).astype("f4").reshape(-1, 6)
    ny, nx = heights.shape
    i = np.arange(ny * nx, dtype="u4").reshape(ny, nx)
    a, b, c, d = i[:-1, :-1], i[:-1, 1:], i[1:, :-1], i[1:, 1:]
    return verts, np.stack([a, c, b, b, c, d], axis=-1).reshape(-1)


def perspective(fovy: float, aspect: float, near: float, far: float) -> Array:
    """Build an OpenGL perspective projection matrix, fovy in degrees."""
    f = 1 / math.tan(math.radians(fovy) / 2)
    return np.array(
        [
            [f / aspect, 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, (far + near) / (near - far), 2 * far * near / (near - far)],
            [0, 0, -1, 0],
        ],
    )


def look_at(eye: Array, target: Array, up: tuple[float, float, float] = (0, 0, 1)) -> Array:
    """Build the view matrix of a camera at eye looking at target, z up."""
    f = np.subtract(target, eye)
    f /= np.linalg.norm(f)
    s = np.cross(f, up)
    s /= np.linalg.norm(s)
    m = np.identity(4)
    m[0, :3], m[1, :3], m[2, :3] = s, np.cross(s, f), -f
    m[:3, 3] = -m[:3, :3] @ eye
    return m


class Scene:
    """The site on the GPU: its ground, surroundings and points, and the buffers a frame is drawn in."""

    def __init__(
        self,
        cache: Path,
        device: int,
        altitude: float = ALTITUDE,
        pitch: float = PITCH,
        fps: int = FPS,
    ) -> None:
        """Load the cache onto the GPU and set the camera's height, tilt and frame rate."""
        self.ctx = ctx = moderngl.create_standalone_context(backend="egl", device_index=device)
        grid = json.loads((cache / "grid.json").read_text())
        nx, ny = grid["size"]
        west, south, east, north = bounds = grid["bounds_3857"]
        dx, dy = (east - west) / nx, (north - south) / ny
        surface = np.fromfile(cache / "surface.bin", dtype=np.float32).reshape(ny, nx)
        ground = np.fromfile(cache / "ground.bin", dtype=np.float32).reshape(ny, nx)
        # The ground under a canopy lies in its shade, which the photo, taken from above, shows as treetops.
        cell = dx * TRUE_SCALE
        canopy = gaussian_filter(np.clip(surface - ground - CANOPY_CLEARANCE, 0, None), 1.5 / cell)
        near_mesh = grid_mesh(
            west + (np.arange(nx) + 0.5) * dx,
            north - (np.arange(ny) + 0.5) * dy,
            ground,
            bounds,
            np.clip(canopy / CANOPY_FULL_SHADE, 0, 1),
        )
        # The surroundings are cut where the near ground lies, one cell inside its edge.
        self.hole = (*local(west + dx, south + dy), *local(east - dx, north - dy))
        sur = json.loads((DATA / "surroundings.json").read_text())
        snx, sny = sur["size"]
        sw, ss, se, sn = sur["bounds"]
        lat = (ss + sn) / 2
        sxs = np.array([mercator(sw + (se - sw) * i / (snx - 1), lat)[0] for i in range(snx)])
        sys_ = np.array([mercator(sw, sn - (sn - ss) * j / (sny - 1))[1] for j in range(sny)])
        sh = np.array(sur["heights"], dtype="f4").reshape(sny, snx) / 100 + sur["base"]
        far_mesh = grid_mesh(sxs, sys_, sh, FAR.bounds, np.zeros_like(sh))

        self.mesh_prog = ctx.program(vertex_shader=MESH_VERTEX, fragment_shader=MESH_FRAGMENT)
        self.near, self.far = (
            ctx.vertex_array(
                self.mesh_prog,
                [(ctx.buffer(v.tobytes()), "3f 2f 1f", "pos", "uv", "shade")],
                ctx.buffer(t.tobytes()),
            )
            for v, t in (near_mesh, far_mesh)
        )
        self.near_tex, self.far_tex = (self.texture(cache / name) for name in ("mosaic19.png", "mosaic17.png"))

        pts = np.load(cache / "points.npz")
        xyz = pts["xyz"].astype("f8")
        pos = np.stack([*local(xyz[:, 0] + west, xyz[:, 1] + south), xyz[:, 2]], axis=-1).astype("f4")
        positions, colours = ctx.buffer(pos.tobytes()), ctx.buffer(pts["rgb"].tobytes())
        self.depth_prog = ctx.program(vertex_shader=POINT_VERTEX, fragment_shader=POINT_DEPTH_FRAGMENT)
        self.splat_prog = ctx.program(vertex_shader=POINT_VERTEX, fragment_shader=SPLAT_FRAGMENT)
        self.depth_points = ctx.vertex_array(self.depth_prog, [(positions, "3f", "pos")])
        self.splat_points = ctx.vertex_array(self.splat_prog, [(positions, "3f", "pos"), (colours, "3f1", "col")])

        self.make_buffers()

        # The camera holds its altitude above the ground at the middle of the site.
        middle = ground[ny // 2 - 40 : ny // 2 + 40, nx // 2 - 40 : nx // 2 + 40]
        self.ground = float(np.median(middle))
        self.proj = perspective(VFOV, WIDTH / HEIGHT, 5.0, 8000.0)
        self.pitch, self.fps = pitch, fps
        self.frames = SECONDS * fps
        self.slant = altitude / math.sin(math.radians(pitch))
        self.view_width = 2 * self.slant * math.tan(math.radians(HFOV / 2))

    def make_buffers(self) -> None:
        """Make the buffers a frame is drawn in and the passes that combine them.

        The ground is drawn into scene, the splats' weighted colours into splats, which shares its
        depth but does not write it; composite lays the one over the other into resolved, and reduce
        filters resolved down into accum, one exposure after another.
        """
        ctx = self.ctx
        rw, rh = WIDTH * SUPERSAMPLE, HEIGHT * SUPERSAMPLE
        depth = ctx.depth_texture((rw, rh))
        self.scene_tex = ctx.texture((rw, rh), 4)
        self.scene = ctx.framebuffer(color_attachments=[self.scene_tex], depth_attachment=depth)
        self.splat_tex = ctx.texture((rw, rh), 4, dtype="f4")
        self.splats = ctx.framebuffer(color_attachments=[self.splat_tex], depth_attachment=depth)
        self.splats.depth_mask = False
        self.composite_prog = ctx.program(vertex_shader=FULLSCREEN_VERTEX, fragment_shader=COMPOSITE_FRAGMENT)
        self.composite = ctx.vertex_array(self.composite_prog, [])
        self.resolved_tex = ctx.texture((rw, rh), 4)
        self.resolved = ctx.framebuffer(color_attachments=[self.resolved_tex])
        self.accum = ctx.framebuffer(color_attachments=[ctx.texture((WIDTH, HEIGHT), 4, dtype="f4")])
        self.reduce_prog = ctx.program(vertex_shader=FULLSCREEN_VERTEX, fragment_shader=REDUCE_FRAGMENT)
        self.reduce = ctx.vertex_array(self.reduce_prog, [])
        self.point_scale = rh / (2 * math.tan(math.radians(VFOV) / 2))
        ctx.enable(moderngl.PROGRAM_POINT_SIZE)

    def texture(self, path: Path) -> moderngl.Texture:
        """Upload an image as a mipmapped, anisotropically filtered texture."""
        image = Image.open(path).convert("RGB")
        tex = self.ctx.texture(image.size, 3, image.tobytes())
        tex.build_mipmaps()
        tex.filter = (moderngl.LINEAR_MIPMAP_LINEAR, moderngl.LINEAR)
        tex.anisotropy = 16.0
        tex.repeat_x = tex.repeat_y = False
        return tex

    def camera(self, f: float) -> tuple[Array, Array]:
        """Place the eye and the point it looks at, f frames into the glide.

        The glide passes over the site's centre halfway through.
        """
        seconds = f / self.fps - (SECONDS + CROSSFADE) / 2
        travel = SPEED * self.view_width * seconds
        bearing = math.radians(BEARING)
        target = np.array([travel * math.sin(bearing), travel * math.cos(bearing), self.ground])
        p = math.radians(self.pitch)
        return target - np.array([0.0, math.cos(p), -math.sin(p)]) * self.slant, target

    def exposure(self, f: float) -> None:
        """Draw the scene at frame time f at the render size, resolved into resolved_tex."""
        ctx = self.ctx
        eye, target = self.camera(f)
        mvp = (self.proj @ look_at(eye, target)).T.astype("f4").tobytes()
        cam = tuple(eye)
        for prog in (self.mesh_prog, self.depth_prog, self.splat_prog):
            prog["mvp"].write(mvp)
            prog["cam"].value = cam
        for prog in (self.mesh_prog, self.splat_prog):
            prog["haze"].value = HAZE
            prog["haze_distance"].value = HAZE_DISTANCE
        for prog, push in ((self.depth_prog, SPLAT_DEPTH), (self.splat_prog, 0.0)):
            prog["scale"].value = self.point_scale
            prog["size"].value = SPLAT_SIZE
            prog["push"].value = push
        self.splat_prog["falloff"].value = SPLAT_FALLOFF
        self.depth_prog["core"].value = SPLAT_CORE

        # The ground and the surroundings, with their depth.
        self.scene.use()
        ctx.enable(moderngl.DEPTH_TEST)
        ctx.disable(moderngl.BLEND)
        self.scene.clear(*HAZE, 1.0, depth=1.0)
        self.mesh_prog["hole"].value = self.hole
        self.mesh_prog["canopy_shade"].value = CANOPY_SHADE
        self.mesh_prog["tex"].value = 0
        self.mesh_prog["cut"].value = True
        self.far_tex.use(0)
        self.far.render()
        self.mesh_prog["cut"].value = False
        self.near_tex.use(0)
        self.near.render()
        # The points' depth, pushed back by SPLAT_DEPTH, without colour.
        self.scene.color_mask = (False, False, False, False)
        self.depth_points.render(moderngl.POINTS)
        self.scene.color_mask = (True, True, True, True)
        # The weighted colours of the points that lie within SPLAT_DEPTH of the nearest surface.
        self.splats.use()
        self.splats.clear(0.0, 0.0, 0.0, 0.0)
        ctx.enable(moderngl.BLEND)
        ctx.blend_func = moderngl.ONE, moderngl.ONE
        self.splat_points.render(moderngl.POINTS)
        # The canopy, its colours divided by their weights, over the ground.
        self.resolved.use()
        ctx.disable(moderngl.DEPTH_TEST)
        ctx.disable(moderngl.BLEND)
        self.scene_tex.use(0)
        self.splat_tex.use(1)
        self.composite_prog["scene"].value = 0
        self.composite_prog["splats"].value = 1
        self.composite_prog["cover"].value = SPLAT_COVER
        self.composite.render(moderngl.TRIANGLES, vertices=3)

    def frame(self, f: float) -> Array:
        """Record the glide f frames in, as RGB rows from the top.

        Its exposures over the open shutter are averaged on the GPU.
        """
        ctx = self.ctx
        self.accum.use()
        self.accum.clear(0.0, 0.0, 0.0, 0.0)
        for i in range(EXPOSURES):
            self.exposure(f + SHUTTER * ((i + 0.5) / EXPOSURES - 0.5))
            self.accum.use()
            ctx.disable(moderngl.DEPTH_TEST)
            ctx.enable(moderngl.BLEND)
            ctx.blend_func = moderngl.ONE, moderngl.ONE
            self.resolved_tex.use(0)
            self.reduce_prog["src"].value = 0
            self.reduce_prog["ss"].value = SUPERSAMPLE
            self.reduce_prog["weight"].value = 1.0 / EXPOSURES
            self.reduce.render(moderngl.TRIANGLES, vertices=3)
        rgb = np.frombuffer(self.accum.read(components=3, dtype="f4"), dtype=np.float32).reshape(HEIGHT, WIDTH, 3)
        return np.flipud(np.clip(np.rint(rgb * 255), 0, 255).astype(np.uint8))

    def output(self, j: int) -> Array:
        """Record frame j of the loop.

        The glide runs CROSSFADE seconds longer than the loop; its first frames are blended with
        the ones that run past the loop's end, so frame 0 continues from the last.
        """
        fade = round(CROSSFADE * self.fps)
        if j >= fade:
            return self.frame(j)
        w = (j + 0.5) / fade
        late = self.frame(j + self.frames).astype(np.float32)
        return np.rint(late * (1 - w) + self.frame(j).astype(np.float32) * w).astype(np.uint8)


def render_master(scene: Scene, path: Path) -> None:
    """Render the loop and keep it near-lossless in path."""
    ffmpeg = subprocess.Popen(
        [
            FFMPEG,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{WIDTH}x{HEIGHT}",
            "-r",
            str(scene.fps),
            "-i",
            "-",
            *MASTER,
            str(path),
        ],
        stdin=subprocess.PIPE,
    )
    for j in range(scene.frames):
        ffmpeg.stdin.write(scene.output(j).tobytes())
        if j % 60 == 0:
            log.info("frame %d/%d", j, scene.frames)
    ffmpeg.stdin.close()
    if ffmpeg.wait():
        sys.exit("ffmpeg failed")
    log.info("%s %.1f MB", path, path.stat().st_size / 1e6)


def encode_web(master: Path, out: Path, passlog: Path) -> None:
    """Encode the web video from the master in two passes, at WEB_MEGABYTES, and its poster beside it."""
    probe = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v", "-count_packets",
         "-show_entries", "stream=nb_read_packets:format=duration", "-of", "json", str(master)],
        capture_output=True, check=True, text=True,
    )  # fmt: skip
    info = json.loads(probe.stdout)
    frames, seconds = int(info["streams"][0]["nb_read_packets"]), float(info["format"]["duration"])
    kbps = int(WEB_MEGABYTES * 8e3 / seconds)
    options = [
        *WEB_ENCODE, "-b:v", f"{kbps}k", "-passlogfile", str(passlog),
        "-x264-params", f"aq-mode=3:keyint={frames}:min-keyint={frames}:scenecut=0",
    ]  # fmt: skip
    for number, target in ((1, ["-f", "null", "-"]), (2, ["-movflags", "+faststart", str(out)])):
        subprocess.run(
            [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(master), *options,
             "-pass", str(number), *target],
            check=True,
        )  # fmt: skip
    poster = out.with_suffix(".jpg")
    subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(out), "-frames:v", "1",
         "-q:v", str(POSTER_QUALITY), str(poster)],
        check=True,
    )  # fmt: skip
    for path in (out, poster):
        log.info("%s %.2f MB", path, path.stat().st_size / 1e6)


def list_devices() -> None:
    """Log the EGL devices by index, until moderngl finds no more."""
    index = 0
    while True:
        try:
            ctx = moderngl.create_standalone_context(backend="egl", device_index=index)
        except Exception:  # moderngl reports a missing device with a bare Exception, nothing narrower
            return
        log.info("%d %s", index, ctx.info["GL_RENDERER"])
        ctx.release()
        index += 1


def main() -> None:
    """Parse the command line and render what it asks for."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--device", type=int, default=0, help="the EGL device to render on (see --list-devices)")
    parser.add_argument("--out", type=Path, default=ROOT / "public" / "balmoos.mp4")
    parser.add_argument("--encode-only", action="store_true", help="encode the web video from the cached master")
    parser.add_argument("--still", nargs=2, metavar=("FRAME", "PNG"), help="write one frame as a PNG instead")
    parser.add_argument("--altitude", type=float, default=ALTITUDE, help="metres above the ground at the site")
    parser.add_argument("--pitch", type=float, default=PITCH, help="degrees below the horizon")
    parser.add_argument("--fps", type=int, default=FPS)
    parser.add_argument("--list-devices", action="store_true")
    args = parser.parse_args()
    if args.list_devices:
        list_devices()
        return
    master = args.cache / "master.mp4"
    if not args.encode_only:
        scene = Scene(args.cache, args.device, args.altitude, args.pitch, args.fps)
        if args.still:
            Image.fromarray(scene.output(int(args.still[0]))).save(args.still[1])
            return
        render_master(scene, master)
    encode_web(master, args.out, args.cache / "x264-pass")


if __name__ == "__main__":
    main()
