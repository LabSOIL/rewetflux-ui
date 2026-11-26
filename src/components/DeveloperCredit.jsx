import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import LanguageIcon from '@mui/icons-material/Language';
import './DeveloperCredit.css';

/** Where the developer can be found, each shown as its icon. */
export const DEVELOPER_LINKS = [
  { label: 'Evan Thomas on GitHub', href: 'https://github.com/evanjt', Icon: GitHubIcon },
  { label: 'Evan Thomas on LinkedIn', href: 'https://www.linkedin.com/in/evanjt', Icon: LinkedInIcon },
  { label: 'Website of Evan Thomas', href: 'https://evanjt.com', Icon: LanguageIcon },
];

/** Who developed the site, with icon links to their profiles, as the map's info panel and the project overlay show it. */
export default function DeveloperCredit() {
  return (
    <span className="developer-credit">
      <span>Development: Evan Thomas</span>
      {DEVELOPER_LINKS.map(({ label, href, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
          <Icon />
        </a>
      ))}
    </span>
  );
}
