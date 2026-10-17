import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Wallet root element is missing");

root.innerHTML = `
  <div class="layout">
    <aside class="rail">
      <div class="brand"><img src="./assets/veylora-mark.svg" alt="" /><span>VEYLORA</span></div>
      <div class="rail-label">WALLET</div>
      <div class="nav active"><span>◈</span> Overview</div>
      <div class="nav muted"><span>↗</span> Send</div>
      <div class="nav muted"><span>＋</span> Receive</div>
      <div class="nav muted"><span>↻</span> Activity</div>
      <div class="rail-bottom"><div class="secure-dot"></div><span>Local-first by design</span></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div><div class="eyebrow">ZCASH WALLET</div><h1>Your money. Your keys.</h1></div>
        <div class="network"><span class="dot"></span> TESTNET</div>
      </header>
      <section class="hero">
        <div class="hero-mark"><img src="./assets/veylora-mark.svg" alt="" /></div>
        <div class="eyebrow">A WALLET OF YOUR OWN</div>
        <h2>Privacy starts<br/>with <span>ownership.</span></h2>
        <p class="intro">A standalone Zcash wallet for transparent and shielded payments. No other wallet required.</p>
        <div class="notice"><span class="notice-icon">!</span><div><strong>Wallet engine integration in progress</strong><p>This build does not generate keys, restore wallets, sync balances, or send transactions. Do not use it to store funds. We will only enable wallet actions after the cryptographic engine and persistence have been tested.</p></div></div>
        <div class="actions">
          <button class="primary" disabled>Create new wallet <span>↗</span></button>
          <button class="secondary" disabled>Restore with recovery phrase</button>
        </div>
        <div class="security-line"><span>⌑</span> Self-custody <i></i> <span>◉</span> Shielded payments <i></i> <span>⌁</span> Open-source engine</div>
      </section>
      <section class="bottom-grid">
        <article class="info-card"><div class="card-icon">◈</div><h3>Keys stay yours</h3><p>Wallet secrets must be encrypted locally. No server should receive recovery phrases or private keys.</p></article>
        <article class="info-card"><div class="card-icon">◌</div><h3>Privacy by default</h3><p>Shielded transactions require real Zcash proving, synchronization, and careful transaction review.</p></article>
        <article class="info-card"><div class="card-icon">⌁</div><h3>Built to verify</h3><p>We will test recovery, synchronization, sending, and confirmation before enabling real wallet actions.</p></article>
      </section>
      <footer><span>VEY LORA <b>·</b> EARLY DEVELOPMENT BUILD</span><a href="https://github.com/Lordprolific/veylora-testnet-wallet/blob/main/docs/STANDALONE-WALLET-PLAN.md" target="_blank" rel="noreferrer">Engineering roadmap ↗</a></footer>
    </main>
  </div>
`;
