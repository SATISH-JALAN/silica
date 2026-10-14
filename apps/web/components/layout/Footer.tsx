import Link from "next/link";
import { Emblem } from "@/components/brand/Emblem";
import { Wordmark } from "@/components/brand/Wordmark";

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-void">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Emblem size={30} />
            <Wordmark className="h-[14px] w-auto text-cream" strokeWidth={4} />
          </div>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-dust">
            Deliverable GPU-hour forwards on Monad. Bond-backed issuance, onchain order books, delivery verified by Chainlink CRE.
          </p>
          <p className="label mt-6 !text-[9px]">Real compute · Real possibilities</p>
        </div>
        <FooterCol title="Market" links={[["Markets", "/markets"], ["H100·APAC·W44", "/markets/h100-apac-w44"], ["Forward curve", "/markets#curve"]]} />
        <FooterCol title="Participants" links={[["Provider console", "/provider"], ["Redeem & tickets", "/tickets"], ["How it works", "/#lifecycle"]]} />
        <FooterCol title="Proof" links={[["Status & contracts", "/status"], ["Documentation", "/docs"], ["Monad explorer", "https://testnet.monadvision.com"], ["Faucet", "https://faucet.monad.xyz"]]} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-5 text-[11px] text-ash sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Testnet only. Provider nodes and liquidity are simulated. Not an offering of any financial product.</span>
          <span>Built for Monad Metropolis · Track 1</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="label">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("http") ? (
              <a href={href} target="_blank" rel="noreferrer" className="text-sm text-sand transition-[color,background-color,border-color,box-shadow] hover:text-gold-hot">
                {label} ↗
              </a>
            ) : href.startsWith("/docs") ? (
              <a href={href} target="_blank" rel="noopener" className="text-sm text-sand transition-[color,background-color,border-color,box-shadow] hover:text-gold-hot">
                {label} ↗
              </a>
            ) : (
              <Link href={href} className="text-sm text-sand transition-[color,background-color,border-color,box-shadow] hover:text-gold-hot">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
