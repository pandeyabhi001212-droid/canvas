class MathEngine {
  constructor() {
    this.precedence = {
      '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, 'u-': 3
    };
    this.associativity = {
      '+': 'LEFT', '-': 'LEFT', '*': 'LEFT', '/': 'LEFT', '%': 'LEFT', 'u-': 'RIGHT'
    };
  }

  stripFloatError(num) {
    if (typeof num !== 'number') return num;
    if (Number.isInteger(num)) return num;
    return parseFloat(num.toPrecision(12));
  }

  safeAdd(a, b) { return this.stripFloatError(a + b); }
  safeSub(a, b) { return this.stripFloatError(a - b); }
  safeMul(a, b) { return this.stripFloatError(a * b); }

  safeDiv(a, b) {
    if (b === 0) throw new Error('Cannot divide by zero');
    return this.stripFloatError(a / b);
  }

  safeMod(a, b) {
    if (b === 0) throw new Error('Cannot divide by zero');
    const aStr = a.toString();
    const bStr = b.toString();
    const aDec = aStr.includes('.') ? aStr.split('.')[1].length : 0;
    const bDec = bStr.includes('.') ? bStr.split('.')[1].length : 0;
    const maxDec = Math.max(aDec, bDec);
    if (maxDec === 0) return a % b;
    const factor = Math.pow(10, maxDec);
    const aScaled = Math.round(a * factor);
    const bScaled = Math.round(b * factor);
    return (aScaled % bScaled) / factor;
  }

  tokenize(exprStr) {
    let cleanStr = exprStr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\s+/g, '');

    const tokens = [];
    let i = 0;

    while (i < cleanStr.length) {
      const char = cleanStr[i];

      if (/[0-9.]/.test(char)) {
        let numStr = '';
        while (i < cleanStr.length && /[0-9.]/.test(cleanStr[i])) {
          numStr += cleanStr[i];
          i++;
        }
        if ((numStr.match(/\./g) || []).length > 1) {
          throw new Error('Invalid syntax');
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
        continue;
      }

      if (char === '(' || char === ')') {
        tokens.push({ type: 'PAREN', value: char });
        i++;
        continue;
      }

      if (['+', '-', '*', '/', '%'].includes(char)) {
        if (char === '-') {
          const lastToken = tokens[tokens.length - 1];
          const isUnary = !lastToken ||
            lastToken.type === 'OPERATOR' ||
            (lastToken.type === 'PAREN' && lastToken.value === '(');
          if (isUnary) {
            tokens.push({ type: 'UNARY_MINUS', value: 'u-' });
            i++;
            continue;
          }
        }
        tokens.push({ type: 'OPERATOR', value: char });
        i++;
        continue;
      }

      throw new Error('Invalid syntax');
    }

    return tokens;
  }

  evaluate(exprStr) {
    if (!exprStr || exprStr.trim() === '' || exprStr === '0') return 0;

    const tokens = this.tokenize(exprStr);

    let openParens = 0;
    let closeParens = 0;
    for (const token of tokens) {
      if (token.type === 'PAREN') {
        if (token.value === '(') openParens++;
        else if (token.value === ')') closeParens++;
      }
    }
    while (openParens > closeParens) {
      tokens.push({ type: 'PAREN', value: ')' });
      closeParens++;
    }

    const outputQueue = [];
    const operatorStack = [];

    for (const token of tokens) {
      if (token.type === 'NUMBER') {
        outputQueue.push(token);
      } else if (token.type === 'UNARY_MINUS' || token.type === 'OPERATOR') {
        let topOp = operatorStack[operatorStack.length - 1];
        while (
          topOp &&
          (topOp.type === 'OPERATOR' || topOp.type === 'UNARY_MINUS') &&
          (
            (this.associativity[token.value] === 'LEFT' && this.precedence[token.value] <= this.precedence[topOp.value]) ||
            (this.associativity[token.value] === 'RIGHT' && this.precedence[token.value] < this.precedence[topOp.value])
          )
        ) {
          outputQueue.push(operatorStack.pop());
          topOp = operatorStack[operatorStack.length - 1];
        }
        operatorStack.push(token);
      } else if (token.type === 'PAREN' && token.value === '(') {
        operatorStack.push(token);
      } else if (token.type === 'PAREN' && token.value === ')') {
        let topOp = operatorStack[operatorStack.length - 1];
        while (topOp && !(topOp.type === 'PAREN' && topOp.value === '(')) {
          outputQueue.push(operatorStack.pop());
          topOp = operatorStack[operatorStack.length - 1];
        }
        if (!topOp) throw new Error('Mismatched parentheses');
        operatorStack.pop();
      }
    }

    while (operatorStack.length > 0) {
      const topOp = operatorStack.pop();
      if (topOp.type === 'PAREN') throw new Error('Mismatched parentheses');
      outputQueue.push(topOp);
    }

    const evalStack = [];
    for (const token of outputQueue) {
      if (token.type === 'NUMBER') {
        evalStack.push(token.value);
      } else if (token.type === 'UNARY_MINUS') {
        if (evalStack.length < 1) throw new Error('Invalid syntax');
        const val = evalStack.pop();
        evalStack.push(-val);
      } else if (token.type === 'OPERATOR') {
        if (evalStack.length < 2) throw new Error('Invalid syntax');
        const right = evalStack.pop();
        const left = evalStack.pop();
        let result;
        switch (token.value) {
          case '+': result = this.safeAdd(left, right); break;
          case '-': result = this.safeSub(left, right); break;
          case '*': result = this.safeMul(left, right); break;
          case '/': result = this.safeDiv(left, right); break;
          case '%': result = this.safeMod(left, right); break;
          default: throw new Error('Invalid syntax');
        }
        evalStack.push(result);
      }
    }

    if (evalStack.length !== 1) throw new Error('Invalid syntax');
    return evalStack[0];
  }
}

class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('spectra_muted') === 'true';
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playClick() {
    if (this.muted) return;
    try {
      this.init();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.045);
    } catch (e) {
      console.warn('Audio synthesis failed', e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('spectra_muted', this.muted);
    return this.muted;
  }
}

class HistoryManager {
  constructor() {
    this.key = 'spectra_calc_history';
  }

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || [];
    } catch {
      return [];
    }
  }

  addEntry(expression, result) {
    const history = this.getHistory();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    history.unshift({ expression, result, timestamp });
    if (history.length > 50) history.pop();
    localStorage.setItem(this.key, JSON.stringify(history));
  }

  clear() {
    localStorage.removeItem(this.key);
  }
}

class CalculatorUI {
  constructor() {
    this.math = new MathEngine();
    this.audio = new AudioManager();
    this.history = new HistoryManager();
    this.expression = '0';
    this.lastResult = null;
    this.isCalculated = false;
    this.memoryVal = parseFloat(localStorage.getItem('spectra_memory')) || 0;

    this.initDOM();
    this.initThemes();
    this.bindEvents();
    this.updateScreen();
  }

  initDOM() {
    this.displayHistory = document.getElementById('displayHistory');
    this.displayExpr = document.getElementById('displayExpression');
    this.displayPreview = document.getElementById('displayPreview');
    this.themeBtn = document.getElementById('themeToggle');
    this.soundBtn = document.getElementById('soundToggle');
    this.historyBtn = document.getElementById('historyToggle');
    this.clearHistoryBtn = document.getElementById('clearHistory');
    this.drawer = document.getElementById('historyDrawer');
    this.overlay = document.getElementById('drawerOverlay');
    this.historyList = document.getElementById('historyList');
    this.memBadge = document.getElementById('memoryIndicator');

    if (this.audio.muted) {
      this.soundBtn.classList.add('muted');
    }
  }

  initThemes() {
    const savedTheme = localStorage.getItem('spectra_theme');
    const activeTheme = savedTheme || 'light';
    document.documentElement.setAttribute('data-theme', activeTheme);
  }

  bindEvents() {
    document.querySelectorAll('.key').forEach(button => {
      button.addEventListener('click', (e) => {
        this.audio.playClick();
        this.createRipple(e);
        const char = button.getAttribute('data-char');
        const action = button.getAttribute('data-action');
        if (char) this.handleInputChar(char);
        else if (action) this.handleAction(action);
      });
    });

    document.querySelectorAll('.memory-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.audio.playClick();
        this.createRipple(e);
        const action = btn.getAttribute('data-action');
        const char = btn.getAttribute('data-char');
        if (action) this.handleMemoryAction(action);
        if (char) this.handleInputChar(char);
      });
    });

    this.themeBtn.addEventListener('click', (e) => {
      this.audio.playClick();
      this.createRipple(e);
      this.toggleTheme();
    });

    this.soundBtn.addEventListener('click', (e) => {
      this.createRipple(e);
      const isMuted = this.audio.toggleMute();
      this.soundBtn.classList.toggle('muted', isMuted);
      if (!isMuted) this.audio.playClick();
    });

    this.historyBtn.addEventListener('click', (e) => {
      this.audio.playClick();
      this.createRipple(e);
      this.openDrawer();
    });

    this.clearHistoryBtn.addEventListener('click', (e) => {
      this.audio.playClick();
      this.createRipple(e);
      this.history.clear();
      this.renderHistory();
    });

    this.overlay.addEventListener('click', () => this.closeDrawer());

    window.addEventListener('keydown', (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      const key = e.key;

      if (key >= '0' && key <= '9') {
        this.audio.playClick();
        this.handleInputChar(key);
        this.triggerButtonVisualFeedback(key);
      } else if (key === '.') {
        this.audio.playClick();
        this.handleInputChar('.');
        this.triggerButtonVisualFeedback('.');
      } else if (key === '+') {
        this.audio.playClick();
        this.handleInputChar('+');
        this.triggerButtonVisualFeedback('+');
      } else if (key === '-') {
        this.audio.playClick();
        this.handleInputChar('-');
        this.triggerButtonVisualFeedback('-');
      } else if (key === '*' || key.toLowerCase() === 'x') {
        this.audio.playClick();
        this.handleInputChar('×');
        this.triggerButtonVisualFeedback('×');
      } else if (key === '/') {
        this.audio.playClick();
        this.handleInputChar('÷');
        this.triggerButtonVisualFeedback('÷');
      } else if (key === '%') {
        this.audio.playClick();
        this.handleInputChar('%');
        this.triggerButtonVisualFeedback('%');
      } else if (key === '(' || key === ')') {
        this.audio.playClick();
        this.handleKeyboardParenthesis(key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        this.audio.playClick();
        this.handleAction('calculate');
        this.triggerButtonVisualFeedback('calculate');
      } else if (key === 'Backspace') {
        e.preventDefault();
        this.audio.playClick();
        this.handleAction('backspace');
        this.triggerButtonVisualFeedback('backspace');
      } else if (key === 'Escape') {
        e.preventDefault();
        this.audio.playClick();
        this.handleAction('clear');
        this.triggerButtonVisualFeedback('clear');
      }
    });
  }

  isErrorState() {
    return this.expression === 'Error' ||
      this.expression === 'Cannot divide by zero' ||
      this.expression === 'Invalid syntax';
  }

  handleInputChar(char) {
    if (this.isErrorState()) {
      this.expression = '0';
      this.isCalculated = false;
    }

    const lastChar = this.expression.slice(-1);
    const isOperator = ['+', '-', '×', '÷', '%'].includes(char);
    const lastIsOperator = ['+', '-', '×', '÷', '%'].includes(lastChar);

    if (this.isCalculated) {
      this.isCalculated = false;
      if (isOperator) {
        this.expression = this.expression + char;
      } else if (char === '.') {
        this.expression = '0.';
      } else {
        this.expression = char;
      }
      this.updateScreen();
      return;
    }

    if (char === '.') {
      if (lastChar === ')') return;
      const numberMatches = this.expression.match(/([0-9.]+)(?!.*[0-9.])$/);
      if (numberMatches && numberMatches[0].includes('.')) return;
      if (lastIsOperator || lastChar === '(' || this.expression === '0' || this.expression === '') {
        this.expression = this.expression === '0' ? '0.' : this.expression + '0.';
        this.updateScreen();
        return;
      }
    }

    if (isOperator) {
      if (this.expression === '0' || this.expression === '') {
        if (char === '-') {
          this.expression = '-';
        } else {
          this.expression = '0' + char;
        }
        this.updateScreen();
        return;
      }
      if (lastIsOperator) {
        this.expression = this.expression.slice(0, -1) + char;
        this.updateScreen();
        return;
      }
      if (lastChar === '(') {
        if (char === '-') this.expression += '-';
        return;
      }
    }

    if (!isOperator && char !== '.') {
      if (this.expression === '0') {
        this.expression = char;
      } else if (lastChar === ')') {
        this.expression += '×' + char;
      } else {
        this.expression += char;
      }
    } else if (char !== '.') {
      this.expression += char;
    }

    this.updateScreen();
  }

  handleAction(action) {
    if (this.isErrorState() && action !== 'clear') {
      this.expression = '0';
      this.isCalculated = false;
      this.updateScreen();
      return;
    }

    switch (action) {
      case 'clear':
        this.expression = '0';
        this.displayHistory.textContent = '';
        this.lastResult = null;
        this.isCalculated = false;
        break;

      case 'backspace':
        if (this.isCalculated) {
          this.expression = '0';
          this.isCalculated = false;
        } else {
          if (this.expression.endsWith('(-')) {
            this.expression = this.expression.slice(0, -2);
          } else {
            this.expression = this.expression.slice(0, -1);
          }
          if (this.expression === '') this.expression = '0';
        }
        break;

      case 'parentheses':
        this.handleParenthesesLogic();
        break;

      case 'negate':
        this.handleNegationLogic();
        break;

      case 'calculate':
        this.evaluateExpression();
        break;
    }

    this.updateScreen();
  }

  handleKeyboardParenthesis(paren) {
    if (this.isErrorState()) {
      this.expression = '0';
      this.isCalculated = false;
    }

    const lastChar = this.expression.slice(-1);

    if (this.isCalculated) {
      this.isCalculated = false;
      this.expression = paren === '(' ? '(' : '0';
      this.updateScreen();
      return;
    }

    if (paren === '(') {
      if (this.expression === '0') {
        this.expression = '(';
      } else if (/[0-9)]/.test(lastChar)) {
        this.expression += '×(';
      } else {
        this.expression += '(';
      }
    } else {
      const openCount = (this.expression.match(/\(/g) || []).length;
      const closeCount = (this.expression.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        if (['+', '-', '×', '÷', '%', '('].includes(lastChar)) return;
        this.expression += ')';
      }
    }
    this.updateScreen();
  }

  handleParenthesesLogic() {
    const expr = this.expression;
    if (expr === '0') {
      this.expression = '(';
      return;
    }

    const openCount = (expr.match(/\(/g) || []).length;
    const closeCount = (expr.match(/\)/g) || []).length;
    const lastChar = expr.slice(-1);

    if (openCount > closeCount) {
      if (/[0-9)]/.test(lastChar)) {
        this.expression += ')';
      } else {
        this.expression += '(';
      }
    } else {
      if (/[0-9)]/.test(lastChar)) {
        this.expression += '×(';
      } else {
        this.expression += '(';
      }
    }
  }

  handleNegationLogic() {
    if (this.isCalculated) {
      this.isCalculated = false;
      const val = parseFloat(this.expression);
      if (!isNaN(val) && val !== 0) {
        this.expression = this.math.stripFloatError(-val).toString();
      }
      return;
    }

    const expr = this.expression;
    if (expr === '0') return;

    const negatedGroupMatch = expr.match(/\(-\d+(\.\d+)?\)$/);
    if (negatedGroupMatch) {
      const matchStr = negatedGroupMatch[0];
      const numStr = matchStr.slice(2, -1);
      this.expression = expr.slice(0, -matchStr.length) + numStr;
      return;
    }

    const positiveNumberMatch = expr.match(/\d+(\.\d+)?$/);
    if (positiveNumberMatch) {
      const numStr = positiveNumberMatch[0];
      this.expression = expr.slice(0, -numStr.length) + `(-${numStr})`;
      return;
    }

    if (['+', '-', '×', '÷', '%'].includes(expr.slice(-1))) {
      this.expression += '(-';
      return;
    }

    if (expr.endsWith('(-')) {
      this.expression = expr.slice(0, -2);
      if (this.expression === '') this.expression = '0';
      return;
    }
  }

  handleMemoryAction(action) {
    if (this.isErrorState()) {
      this.expression = '0';
      this.isCalculated = false;
    }

    let activeValue = 0;
    try {
      activeValue = this.isCalculated ? parseFloat(this.expression) : this.math.evaluate(this.expression);
      if (isNaN(activeValue)) activeValue = 0;
    } catch {
      activeValue = 0;
    }

    const mKey = document.getElementById(`key-${action}`);

    switch (action) {
      case 'mc':
        this.memoryVal = 0;
        localStorage.removeItem('spectra_memory');
        this.flashMemoryKeyEffect(mKey);
        break;

      case 'mr':
        if (this.memoryVal === 0) return;
        this.flashMemoryKeyEffect(mKey);
        const stringMem = this.memoryVal.toString();
        const lastChar = this.expression.slice(-1);
        if (this.isCalculated) {
          this.expression = stringMem;
          this.isCalculated = false;
        } else {
          if (this.expression === '0') {
            this.expression = stringMem;
          } else if (/[0-9)]/.test(lastChar)) {
            this.expression += '×' + stringMem;
          } else {
            this.expression += stringMem;
          }
        }
        break;

      case 'm+':
        this.memoryVal = this.math.safeAdd(this.memoryVal, activeValue);
        localStorage.setItem('spectra_memory', this.memoryVal);
        this.flashMemoryKeyEffect(mKey);
        break;

      case 'm-':
        this.memoryVal = this.math.safeSub(this.memoryVal, activeValue);
        localStorage.setItem('spectra_memory', this.memoryVal);
        this.flashMemoryKeyEffect(mKey);
        break;
    }

    this.updateScreen();
  }

  evaluateExpression() {
    if (this.isErrorState() || this.expression === '') return;

    try {
      const cleanedExpr = this.expression;
      const result = this.math.evaluate(cleanedExpr);
      const formattedResult = result.toString();
      this.history.addEntry(cleanedExpr, formattedResult);
      this.displayHistory.textContent = cleanedExpr + ' =';
      this.expression = formattedResult;
      this.isCalculated = true;
      this.lastResult = result;
    } catch (e) {
      this.displayHistory.textContent = this.expression + ' =';
      this.expression = e.message === 'Cannot divide by zero' ? 'Cannot divide by zero' : 'Error';
      this.isCalculated = true;
      this.lastResult = null;
    }
  }

  updateScreen() {
    this.displayExpr.textContent = this.expression;

    if (this.isCalculated || this.isErrorState() || this.expression === '0') {
      this.displayPreview.textContent = '';
    } else {
      try {
        const preview = this.math.evaluate(this.expression);
        const formattedPreview = preview.toString();
        if (formattedPreview !== this.expression) {
          this.displayPreview.textContent = '= ' + formattedPreview;
        } else {
          this.displayPreview.textContent = '';
        }
      } catch {
        this.displayPreview.textContent = '';
      }
    }

    if (this.memoryVal !== 0) {
      this.memBadge.classList.add('visible');
    } else {
      this.memBadge.classList.remove('visible');
    }

    this.adjustExpressionFontSizeAndScroll();
  }

  adjustExpressionFontSizeAndScroll() {
    const len = this.expression.length;
    this.displayExpr.classList.remove('shrink-medium', 'shrink-small');
    if (len > 18) {
      this.displayExpr.classList.add('shrink-small');
    } else if (len > 12) {
      this.displayExpr.classList.add('shrink-medium');
    }
    setTimeout(() => {
      this.displayExpr.scrollLeft = this.displayExpr.scrollWidth;
    }, 10);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', targetTheme);
    localStorage.setItem('spectra_theme', targetTheme);
  }

  openDrawer() {
    this.renderHistory();
    this.drawer.classList.add('open');
    this.overlay.classList.add('active');
    this.drawer.setAttribute('aria-hidden', 'false');
  }

  closeDrawer() {
    this.drawer.classList.remove('open');
    this.overlay.classList.remove('active');
    this.drawer.setAttribute('aria-hidden', 'true');
  }

  renderHistory() {
    const logs = this.history.getHistory();
    this.historyList.innerHTML = '';

    if (logs.length === 0) {
      this.historyList.innerHTML = `
        <div class="empty-history">
          <svg viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0-2-.9-2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM11 7h2v6h-2zm0 8h2v2h-2z" fill="currentColor"/>
          </svg>
          <p>No calculations yet</p>
        </div>
      `;
      return;
    }

    logs.forEach(log => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `Expression ${log.expression} equals ${log.result}`);

      item.innerHTML = `
        <span class="history-item-exp">${log.expression}</span>
        <span class="history-item-res">${log.result}</span>
        <span class="history-item-date">${log.timestamp}</span>
      `;

      item.addEventListener('click', () => {
        this.audio.playClick();
        this.expression = log.result;
        this.isCalculated = false;
        this.displayHistory.textContent = log.expression + ' =';
        this.closeDrawer();
        this.updateScreen();
      });

      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') item.click();
      });

      this.historyList.appendChild(item);
    });
  }

  createRipple(event) {
    const btn = event.currentTarget;
    const ripple = document.createElement('span');
    ripple.className = 'key-ripple';
    const rect = btn.getBoundingClientRect();
    let x, y;
    if (event.clientX && event.clientY) {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else {
      x = rect.width / 2;
      y = rect.height / 2;
    }
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    const oldRipples = btn.getElementsByClassName('key-ripple');
    for (const r of oldRipples) r.remove();
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }

  flashMemoryKeyEffect(btn) {
    if (!btn) return;
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 250);
  }

  triggerButtonVisualFeedback(keySymbol) {
    let querySelectorStr = '';
    if (keySymbol >= '0' && keySymbol <= '9') {
      querySelectorStr = `.key.number[data-char="${keySymbol}"]`;
    } else if (keySymbol === '.') {
      querySelectorStr = `.key.number[data-char="."]`;
    } else if (['+', '-', '×', '÷', '%'].includes(keySymbol)) {
      querySelectorStr = `.key.operator[data-char="${keySymbol}"]`;
    } else if (keySymbol === 'calculate') {
      querySelectorStr = `.key.equals`;
    } else if (keySymbol === 'backspace') {
      querySelectorStr = `.key.special[data-action="backspace"]`;
    } else if (keySymbol === 'clear') {
      querySelectorStr = `.key.special[data-action="clear"]`;
    }

    if (querySelectorStr) {
      const element = document.querySelector(querySelectorStr);
      if (element) {
        element.classList.add('key-active-mock');
        const clickEvent = {
          currentTarget: element,
          clientX: null,
          clientY: null
        };
        this.createRipple(clickEvent);
        setTimeout(() => element.classList.remove('key-active-mock'), 150);
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.spectraApp = new CalculatorUI();
});
