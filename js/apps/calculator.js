import { VFS } from '../fs.js';
import { WM } from '../wm.js';

/**
 * Halo OS Sleek Glassmorphic Calculator
 * Full key-capture interactive arithmetic panel.
 */
class CalculatorApp {
  constructor() {
    this.displayVal = '0';
    this.equation = '';
    this.isResult = false;
  }

  launch() {
    const id = 'calculator';
    const contentHtml = `
      <div class="calc-container" id="calc-container">
        <!-- Display Monitor Panel -->
        <div class="calc-screen">
          <div class="calc-equation" id="calc-equation"></div>
          <div class="calc-value" id="calc-value">0</div>
        </div>

        <!-- Touch / Click Button Grid -->
        <div class="calc-grid">
          <button class="calc-btn utility" data-key="c">C</button>
          <button class="calc-btn utility" data-key="backspace">⌫</button>
          <button class="calc-btn utility" data-key="%">%</button>
          <button class="calc-btn operator" data-key="/">÷</button>
          
          <button class="calc-btn number" data-key="7">7</button>
          <button class="calc-btn number" data-key="8">8</button>
          <button class="calc-btn number" data-key="9">9</button>
          <button class="calc-btn operator" data-key="*">×</button>
          
          <button class="calc-btn number" data-key="4">4</button>
          <button class="calc-btn number" data-key="5">5</button>
          <button class="calc-btn number" data-key="6">6</button>
          <button class="calc-btn operator" data-key="-">−</button>
          
          <button class="calc-btn number" data-key="1">1</button>
          <button class="calc-btn number" data-key="2">2</button>
          <button class="calc-btn number" data-key="3">3</button>
          <button class="calc-btn operator" data-key="+">+</button>
          
          <button class="calc-btn number zero" data-key="0">0</button>
          <button class="calc-btn number" data-key=".">.</button>
          <button class="calc-btn equals" data-key="=">=</button>
        </div>
      </div>
    `;

    WM.createWindow({
      id,
      title: 'Calculator',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line></svg>`,
      width: 320,
      height: 420,
      contentHtml
    });

    this.setupStyles();
    this.bindEvents();
  }

  bindEvents() {
    const container = document.getElementById('calc-container');
    if (!container) return;

    const btns = container.querySelectorAll('.calc-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        this.processInput(key);
        this.triggerButtonAnimation(btn);
      });
    });

    // Capture physical keyboard layout keystrokes
    const handleKeystroke = (e) => {
      if (WM.activeWindowId !== 'calculator') return;
      
      let key = e.key.toLowerCase();
      if (key === 'enter') key = '=';
      if (key === 'escape') key = 'c';
      if (key === 'delete') key = 'backspace';

      // Match targets
      const matchingBtn = container.querySelector(`.calc-btn[data-key="${key}"]`);
      if (matchingBtn) {
        e.preventDefault();
        this.processInput(key);
        this.triggerButtonAnimation(matchingBtn);
      }
    };

    document.addEventListener('keydown', handleKeystroke);

    // WM lifecycle cleanup: remove keyboard listener when window closes
    WM.onClose('calculator', () => {
      document.removeEventListener('keydown', handleKeystroke);
    });
  }

  processInput(key) {
    const screenVal = document.getElementById('calc-value');
    const screenEq = document.getElementById('calc-equation');
    if (!screenVal || !screenEq) return;

    if (this.isResult && !['+', '-', '*', '/', '%'].includes(key) && key !== '=') {
      this.displayVal = '0';
      this.equation = '';
      this.isResult = false;
    }

    if (key >= '0' && key <= '9') {
      if (this.displayVal === '0') {
        this.displayVal = key;
      } else {
        this.displayVal += key;
      }
    } else if (key === '.') {
      if (!this.displayVal.includes('.')) {
        this.displayVal += '.';
      }
    } else if (key === 'c') {
      this.displayVal = '0';
      this.equation = '';
      this.isResult = false;
    } else if (key === 'backspace') {
      if (this.displayVal.length > 1) {
        this.displayVal = this.displayVal.slice(0, -1);
      } else {
        this.displayVal = '0';
      }
    } else if (['+', '-', '*', '/'].includes(key)) {
      this.isResult = false;
      this.equation = `${this.displayVal} ${key} `;
      this.displayVal = '0';
    } else if (key === '%') {
      const floatVal = parseFloat(this.displayVal);
      this.displayVal = (floatVal / 100).toString();
    } else if (key === '=') {
      if (this.equation && !this.isResult) {
        const fullExpr = this.equation + this.displayVal;
        
        // Sanitize arithmetic parameters securely without eval
        try {
          const sanitizedExpr = fullExpr.replace(/÷/g, '/').replace(/×/g, '*').replace(/[^-()\d/*+.]/g, '');
          const result = Function(`"use strict"; return (${sanitizedExpr})`)();
          
          screenEq.innerText = fullExpr + ' =';
          this.displayVal = Number(result.toFixed(8)).toString(); // format float rounding
          this.equation = '';
          this.isResult = true;
        } catch (e) {
          this.displayVal = 'Error';
          this.equation = '';
          this.isResult = true;
        }
      }
    }

    // Map screen displays
    screenVal.innerText = this.displayVal.replace(/\//g, '÷').replace(/\*/g, '×');
    screenEq.innerText = this.equation.replace(/\//g, '÷').replace(/\*/g, '×');
  }

  triggerButtonAnimation(btn) {
    btn.classList.add('calc-active');
    setTimeout(() => btn.classList.remove('calc-active'), 120);
  }

  setupStyles() {
    if (document.getElementById('calc-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'calc-dynamic-style';
    style.textContent = `
      .calc-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #0c0f13;
        padding: 16px;
        gap: 16px;
      }
      .calc-screen {
        height: 80px;
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: flex-end;
      }
      .calc-equation {
        font-size: 11px;
        color: var(--text-secondary);
        font-weight: 500;
        height: 16px;
      }
      .calc-value {
        font-size: 26px;
        font-weight: 700;
        color: var(--accent-color);
        text-shadow: var(--accent-glowing);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      
      .calc-grid {
        flex-grow: 1;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-gap: 10px;
      }
      
      .calc-btn {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--panel-border);
        border-radius: 10px;
        color: var(--text-primary);
        font-family: var(--font-family-sans);
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .calc-btn:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      
      .calc-btn.utility {
        color: var(--warning-color);
        background: rgba(255, 204, 0, 0.03);
      }
      .calc-btn.operator {
        color: var(--accent-color);
        background: rgba(0, 229, 255, 0.03);
      }
      .calc-btn.equals {
        background: var(--accent-color);
        color: #121820;
        grid-column: span 2;
        font-weight: 700;
      }
      .calc-btn.equals:hover {
        background: #00b8cc;
        box-shadow: var(--accent-glowing);
      }
      .calc-btn.zero {
        grid-column: span 2;
      }
      
      .calc-btn.calc-active {
        transform: scale(0.92);
        background: rgba(255, 255, 255, 0.15);
      }
    `;
    document.head.appendChild(style);
  }
}

export const Calculator = new CalculatorApp();
export default Calculator;
