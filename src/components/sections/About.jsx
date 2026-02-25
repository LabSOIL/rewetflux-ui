import React from "react";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import LanguageIcon from "@mui/icons-material/Language";
import GitHubIcon from "@mui/icons-material/GitHub";


export default function About({ sectionsRef }) {
    return (
        <section
            className="section about-section"
            data-section="about"
            ref={(el) => (sectionsRef.current[3] = el)}
        >
            <div className="about-card distinct-about-card">
                <div className="about-body">
                    <Typography
                        variant="body1"
                        paragraph
                        sx={{ fontSize: "1rem", mb: 1.5, lineHeight: 1.6, textAlign: "justify" }}
                    >
                        RewetFlux provides access to environmental monitoring data from the
                        Balmoos wetland site (46.964°N, 8.060°E) in Nidwalden, Switzerland.
                        The project tracks greenhouse gas fluxes, soil redox conditions, and
                        microclimate variables to understand carbon dynamics in rewetted peatlands.
                    </Typography>
                    <Typography
                        variant="h6"
                        component="h3"
                        sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}
                    >
                        Monitoring data
                    </Typography>
                    <Typography
                        variant="body1"
                        paragraph
                        sx={{ fontSize: "1rem", mb: 1.5, lineHeight: 1.6, textAlign: "justify" }}
                    >
                        <strong>Temperature and moisture</strong> are monitored continuously using{" "}
                        <Link
                            href="https://tomst.com/web/en/systems/tms/tms-4/"
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: "1rem", color: "#90caf9" }}
                        >
                            TMS-4 TOMST loggers
                        </Link>{" "}
                        deployed across 25 measurement positions at the site.
                        Soil moisture is presented as VWC (m³/m³).
                    </Typography>
                    <Typography
                        variant="body1"
                        paragraph
                        sx={{ fontSize: "1rem", mb: 1.5, lineHeight: 1.6, textAlign: "justify" }}
                    >
                        <strong>Gas flux</strong> measurements (CO₂, CH₄, N₂O) are collected using
                        a LI-7810 IRGA chamber system at each collar position. Flux values are
                        computed from chamber headspace concentration changes over time.
                    </Typography>
                    <Typography
                        variant="body1"
                        paragraph
                        sx={{ fontSize: "1rem", mb: 1.5, lineHeight: 1.6, textAlign: "justify" }}
                    >
                        <strong>Redox potential</strong> is measured at four depths (5, 15, 25, 35 cm)
                        to characterise soil aeration and biogeochemical conditions across the wetland.
                    </Typography>

                    <Typography
                        variant="h6"
                        component="h3"
                        sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}
                    >
                        Attribution
                    </Typography>

                    <List dense sx={{ pl: 1, mb: 1 }}>
                        <ListItem disableGutters sx={{ py: 0.3 }}>
                            <Link
                                href="https://www.epfl.ch/labs/soil/"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: "1rem" }}
                            >
                                SOIL — Soil Biogeochemistry Laboratory, EPFL
                            </Link>
                        </ListItem>
                        <ListItem disableGutters sx={{ py: 0.3 }}>
                            <Link
                                href="https://www.epfl.ch/labs/change/"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: "1rem" }}
                            >
                                CHANGE — Laboratory of Construction and Architecture, EPFL
                            </Link>
                        </ListItem>
                        <ListItem disableGutters sx={{ py: 0.3 }}>
                            <Link
                                href="https://www.epfl.ch"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: "1rem" }}
                            >
                                EPFL — École polytechnique fédérale de Lausanne
                            </Link>
                        </ListItem>
                        <ListItem disableGutters sx={{ py: 0.3 }}>
                            <Link
                                href="https://www.snf.ch"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: "1rem" }}
                            >
                                SNSF — Swiss National Science Foundation
                            </Link>
                        </ListItem>
                        <br />
                        <ListItem
                            disableGutters
                            sx={{ py: 0.3, display: "flex", alignItems: "center" }}
                        >
                            <Typography
                                variant="body3"
                                sx={{ fontSize: "1rem", mr: 0.5 }}
                            >
                                Development: Evan Thomas
                            </Typography>
                            <Link
                                href="https://github.com/evanjt"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ ml: 0.5 }}
                            >
                                <GitHubIcon sx={{ fontSize: "1rem", color: "#90caf9" }} />
                            </Link>
                            <Link
                                href="https://www.linkedin.com/in/evanjt"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ ml: 0.5 }}
                            >
                                <LinkedInIcon sx={{ fontSize: "1rem", color: "#90caf9" }} />
                            </Link>
                            <Link
                                href="https://evanjt.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ ml: 0.5 }}
                            >
                                <LanguageIcon sx={{ fontSize: "1rem", color: "#90caf9" }} />
                            </Link>
                        </ListItem>
                    </List>
                </div>
            </div>
        </section>
    );
}
