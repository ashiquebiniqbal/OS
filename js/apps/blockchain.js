import { VFS } from '../fs.js';
import { WM } from '../wm.js';

class BlockchainApp {
  constructor() {
    this.id = 'blockchain';
    this.miningInterval = null;
    this.blocks = [
      { index: 0, timestamp: Date.now(), prevHash: '0000000000000000', hash: this.generateHash('0'), nonce: 12345, txCount: 0 }
    ];
    this.balance = 100.0;
    this.address = '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
  }

  generateHash(input) {
    // Simulated hash function for visual effect
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(16, '0');
    return hex.substring(0, 16);
  }

  launch() {
    const win = WM.createWindow({
      id: this.id,
      title: 'Blockchain Validator Node',
      width: 700,
      height: 460,
      x: window.innerWidth / 2 - 350,
      y: window.innerHeight / 2 - 230,
      icon: `<svg viewBox="0 0 24 24" class="window-title-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`
    });

    if (win) {
      win.querySelector(".window-content") = win.querySelector('.window-content');
      this.setupStyles();
      this.renderContent(win);
      this.attachEvents(win);
      this.renderBlocks(win);
    }
  }

  setupStyles() {
    if (document.getElementById('blockchain-styles')) return;
    const style = document.createElement('style');
    style.id = 'blockchain-styles';
    style.innerHTML = `
      #win-blockchain .window-content {
        background: #0c0f13;
        color: var(--text-primary);
        font-family: var(--font-family-sans);
        display: flex;
        height: 100%;
      }
      .bc-sidebar {
        width: 250px;
        background: rgba(0, 0, 0, 0.4);
        border-right: 1px solid var(--panel-border);
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 16px;
      }
      .bc-panel {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      }
      .bc-chain {
        flex-grow: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: radial-gradient(circle at center, rgba(0,229,255,0.02) 0%, transparent 70%);
      }
      .bc-status {
        height: 30px;
        background: rgba(0,0,0,0.6);
        border-top: 1px solid var(--panel-border);
        display: flex;
        align-items: center;
        padding: 0 16px;
        font-size: 10px;
        font-family: var(--font-family-mono);
        color: var(--text-secondary);
        justify-content: space-between;
      }
      .bc-block {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(0, 229, 255, 0.2);
        border-radius: 12px;
        padding: 12px;
        position: relative;
        animation: blockSlideIn 0.4s ease-out;
      }
      @keyframes blockSlideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .bc-block-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-color);
      }
      .bc-block-row {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        font-family: var(--font-family-mono);
        margin-bottom: 4px;
        color: var(--text-secondary);
      }
      .bc-block-row span:last-child { color: var(--text-primary); }
      .bc-btn {
        background: rgba(0, 229, 255, 0.1);
        border: 1px solid var(--accent-color);
        color: var(--text-primary);
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      .bc-btn:hover { background: rgba(0, 229, 255, 0.2); box-shadow: 0 0 10px rgba(0,229,255,0.2); }
      .bc-btn.mining { background: rgba(255, 59, 48, 0.1); border-color: var(--danger-color); }
      .bc-input {
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--panel-border);
        padding: 8px;
        border-radius: 6px;
        color: var(--text-primary);
        font-family: var(--font-family-mono);
        font-size: 11px;
        width: 100%;
        margin-bottom: 8px;
      }
      .bc-info-box {
        background: rgba(255,255,255,0.02);
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
      }
      .bc-info-box label { color: var(--text-secondary); display: block; margin-bottom: 4px; font-size: 9px; text-transform: uppercase; }
      .bc-info-box div { font-family: var(--font-family-mono); word-break: break-all; }
    `;
    document.head.appendChild(style);
  }

  renderContent(win) {
    win.querySelector(".window-content").innerHTML = `
      <div class="bc-sidebar">
        <select class="bc-input" style="font-family: var(--font-family-sans);">
          <option>Halo Testnet</option>
          <option>Ethereum Simulator</option>
          <option>Local Devnet</option>
        </select>
        <div class="bc-info-box">
          <label>Wallet Address</label>
          <div style="color: var(--accent-color);">${this.address}</div>
        </div>
        <div class="bc-info-box">
          <label>Balance</label>
          <div style="font-size: 18px; font-weight: 700; color: var(--success-color);" id="bc-balance">${this.balance.toFixed(2)} HALO</div>
        </div>
        <button class="bc-btn" id="bc-toggle-mining">Start Mining</button>
        
        <div style="margin-top: 16px; border-top: 1px solid var(--panel-border); padding-top: 16px;">
          <label style="font-size: 10px; color: var(--text-secondary); margin-bottom: 4px; display: block;">Send Transaction</label>
          <input type="text" class="bc-input" placeholder="To Address (0x...)" id="bc-tx-to">
          <input type="number" class="bc-input" placeholder="Amount" id="bc-tx-amt">
          <button class="bc-btn" style="width: 100%; padding: 6px;" id="bc-send-tx">Send</button>
        </div>
      </div>
      <div class="bc-panel">
        <div class="bc-chain" id="bc-chain">
        </div>
        <div class="bc-status">
          <span>Peers: <span id="bc-peers">${Math.floor(Math.random() * 9) + 3}</span> connected</span>
          <span>Height: <span id="bc-height">${this.blocks.length - 1}</span></span>
          <span id="bc-hashrate">Hashrate: 0 H/s</span>
        </div>
      </div>
    `;
  }

  renderBlocks(win) {
    const chain = win.querySelector(".window-content").querySelector('#bc-chain');
    if (!chain) return;
    chain.innerHTML = '';
    // Reverse blocks so newest is at top
    [...this.blocks].reverse().forEach(block => {
      const el = document.createElement('div');
      el.className = 'bc-block';
      el.innerHTML = `
        <div class="bc-block-header">
          <span>Block #${block.index}</span>
          <span>${new Date(block.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="bc-block-row"><span>Hash</span><span>${block.hash}</span></div>
        <div class="bc-block-row"><span>Prev Hash</span><span>${block.prevHash}</span></div>
        <div class="bc-block-row"><span>Nonce</span><span>${block.nonce}</span></div>
        <div class="bc-block-row"><span>Transactions</span><span>${block.txCount}</span></div>
      `;
      chain.appendChild(el);
    });
  }

  attachEvents(win) {
    const toggleBtn = win.querySelector(".window-content").querySelector('#bc-toggle-mining');
    const hashrateEl = win.querySelector(".window-content").querySelector('#bc-hashrate');
    const heightEl = win.querySelector(".window-content").querySelector('#bc-height');
    const balanceEl = win.querySelector(".window-content").querySelector('#bc-balance');
    const sendBtn = win.querySelector(".window-content").querySelector('#bc-send-tx');
    const txTo = win.querySelector(".window-content").querySelector('#bc-tx-to');
    const txAmt = win.querySelector(".window-content").querySelector('#bc-tx-amt');

    toggleBtn.addEventListener('click', () => {
      if (this.miningInterval) {
        clearInterval(this.miningInterval);
        this.miningInterval = null;
        toggleBtn.textContent = 'Start Mining';
        toggleBtn.classList.remove('mining');
        hashrateEl.textContent = 'Hashrate: 0 H/s';
      } else {
        toggleBtn.textContent = 'Stop Mining';
        toggleBtn.classList.add('mining');
        hashrateEl.textContent = 'Hashrate: ' + (Math.random() * 50 + 100).toFixed(2) + ' MH/s';
        
        this.miningInterval = setInterval(() => {
          const lastBlock = this.blocks[this.blocks.length - 1];
          const newIndex = lastBlock.index + 1;
          const timestamp = Date.now();
          const nonce = Math.floor(Math.random() * 1000000);
          const hashInput = `${newIndex}${timestamp}${lastBlock.hash}${nonce}`;
          
          const newBlock = {
            index: newIndex,
            timestamp: timestamp,
            prevHash: lastBlock.hash,
            hash: this.generateHash(hashInput),
            nonce: nonce,
            txCount: Math.floor(Math.random() * 4)
          };
          
          this.blocks.push(newBlock);
          if (this.blocks.length > 50) this.blocks.shift(); // keep it constrained memory-wise
          
          this.balance += 0.5; // Block reward
          
          // Update UI
          this.renderBlocks(win);
          heightEl.textContent = newIndex;
          balanceEl.textContent = this.balance.toFixed(2) + ' HALO';
          hashrateEl.textContent = 'Hashrate: ' + (Math.random() * 50 + 100).toFixed(2) + ' MH/s';
        }, 3000);
      }
    });

    sendBtn.addEventListener('click', () => {
      const amt = parseFloat(txAmt.value);
      if (amt > 0 && amt <= this.balance && txTo.value.startsWith('0x')) {
        this.balance -= amt;
        balanceEl.textContent = this.balance.toFixed(2) + ' HALO';
        txTo.value = '';
        txAmt.value = '';
        alert('Transaction added to mempool');
      } else {
        alert('Invalid transaction parameters or insufficient funds');
      }
    });
    
    // Cleanup on close
    WM.onClose(this.id, () => {
      if (this.miningInterval) {
        clearInterval(this.miningInterval);
        this.miningInterval = null;
      }
    });
  }
}

export default new BlockchainApp();
