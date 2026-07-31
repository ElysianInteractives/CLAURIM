import type { AccountCredentials } from '../net/authenticated_session';

const AUTH_CSS = `
  #auth-gate { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px;
    box-sizing: border-box; color: #eee4c9; background:
      radial-gradient(circle at 50% 25%, rgba(109,82,43,.22), transparent 38%),
      linear-gradient(rgba(5,8,12,.86), rgba(5,8,12,.96)); font-family: Georgia, 'Times New Roman', serif; }
  #auth-gate[hidden] { display: none; }
  #auth-gate .auth-card { width: min(430px, 100%); padding: 28px; box-sizing: border-box;
    background: linear-gradient(150deg, rgba(19,18,18,.98), rgba(29,24,18,.98));
    border: 1px solid rgba(218,198,142,.62); border-radius: 8px; box-shadow: 0 16px 60px rgba(0,0,0,.72); }
  #auth-gate h1 { margin: 0; color: #e5d39c; font-size: 30px; letter-spacing: .08em; text-align: center; }
  #auth-gate .auth-subtitle { margin: 7px 0 22px; color: #bdb39b; font-size: 14px; line-height: 1.45; text-align: center; }
  #auth-gate .auth-tabs { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 20px; border-bottom: 1px solid #665638; }
  #auth-gate .auth-tab { padding: 9px; color: #aaa086; background: transparent; border: 0; border-bottom: 2px solid transparent;
    font: inherit; cursor: pointer; }
  #auth-gate .auth-tab[aria-selected='true'] { color: #f1dfab; border-bottom-color: #c9ab65; }
  #auth-gate label { display: block; margin-top: 13px; color: #d7c9a4; font-size: 13px; letter-spacing: .035em; }
  #auth-gate .auth-display[hidden] { display: none; }
  #auth-gate input { width: 100%; margin-top: 6px; padding: 10px 11px; box-sizing: border-box; color: #f5efe1;
    background: rgba(6,8,11,.82); border: 1px solid rgba(208,189,139,.45); border-radius: 4px;
    font: 15px/1.2 system-ui, sans-serif; outline: none; }
  #auth-gate input:focus { border-color: #d6ba77; box-shadow: 0 0 0 2px rgba(214,186,119,.18); }
  #auth-gate .auth-hint { margin: 7px 0 0; color: #9e9580; font: 12px/1.4 system-ui, sans-serif; }
  #auth-gate .auth-error { min-height: 19px; margin: 13px 0 0; color: #ff9d90; font: 13px/1.4 system-ui, sans-serif; }
  #auth-gate .auth-submit { width: 100%; margin-top: 10px; padding: 11px; color: #17130c; background: #d6bd7d;
    border: 1px solid #f1dda8; border-radius: 4px; font: bold 15px Georgia, serif; cursor: pointer; }
  #auth-gate .auth-submit:hover { background: #e2ca8b; }
  #auth-gate .auth-submit:disabled { opacity: .58; cursor: wait; }
`;

export class AuthGate {
  private readonly root: HTMLDivElement;
  private readonly form: HTMLFormElement;
  private readonly displayField: HTMLLabelElement;
  private readonly password: HTMLInputElement;
  private readonly submit: HTMLButtonElement;
  private readonly error: HTMLParagraphElement;
  private mode: 'login' | 'register' = 'login';

  constructor(onSubmit: (credentials: AccountCredentials) => void) {
    const style = document.createElement('style');
    style.textContent = AUTH_CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'auth-gate';
    this.root.innerHTML = `
      <section class="auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">CLAURIM</h1>
        <p class="auth-subtitle">Enter the realm through your server-owned account.</p>
        <div class="auth-tabs" role="tablist" aria-label="Account action">
          <button class="auth-tab" type="button" data-mode="login" role="tab" aria-selected="true">Sign in</button>
          <button class="auth-tab" type="button" data-mode="register" role="tab" aria-selected="false">Create account</button>
        </div>
        <form novalidate>
          <label>Username
            <input name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+" required />
          </label>
          <label class="auth-display" hidden>Character name
            <input name="displayName" autocomplete="nickname" maxlength="24" />
          </label>
          <label>Password
            <input name="password" type="password" autocomplete="current-password" minlength="15" maxlength="512" required />
          </label>
          <p class="auth-hint">Use 15–128 characters. Spaces and password managers are welcome.</p>
          <p class="auth-error" role="alert" aria-live="polite"></p>
          <button class="auth-submit" type="submit">Sign in</button>
        </form>
      </section>`;
    document.body.appendChild(this.root);
    this.form = this.root.querySelector('form')!;
    this.displayField = this.root.querySelector('.auth-display')!;
    this.password = this.form.elements.namedItem('password') as HTMLInputElement;
    this.submit = this.root.querySelector('.auth-submit')!;
    this.error = this.root.querySelector('.auth-error')!;
    for (const tab of this.root.querySelectorAll<HTMLButtonElement>('.auth-tab')) {
      tab.addEventListener('click', () => this.setMode(tab.dataset.mode === 'register' ? 'register' : 'login'));
    }
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.form.reportValidity()) return;
      const data = new FormData(this.form);
      const username = String(data.get('username') ?? '');
      const password = String(data.get('password') ?? '');
      const passwordCodePoints = [...password].length;
      if (passwordCodePoints < 15 || passwordCodePoints > 128 || new TextEncoder().encode(password).byteLength > 512) {
        this.setError('Use a password containing 15–128 characters.');
        return;
      }
      if (this.mode === 'register') {
        const displayName = String(data.get('displayName') ?? '').trim();
        if (!displayName) {
          this.setError('Choose a character name.');
          return;
        }
        onSubmit({ mode: 'register', username, password, displayName });
      } else {
        onSubmit({ mode: 'login', username, password });
      }
    });
  }

  show(error?: string): void {
    this.root.hidden = false;
    this.password.value = '';
    this.setBusy(false);
    this.setError(error ?? '');
  }

  hide(): void {
    this.root.hidden = true;
    this.password.value = '';
  }

  setBusy(busy: boolean): void {
    for (const control of this.form.elements) {
      if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) control.disabled = busy;
    }
    this.submit.textContent = busy ? 'Entering…' : this.mode === 'register' ? 'Create account' : 'Sign in';
  }

  setError(message: string): void {
    this.error.textContent = message;
  }

  private setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.displayField.hidden = mode !== 'register';
    const displayInput = this.form.elements.namedItem('displayName') as HTMLInputElement;
    displayInput.required = mode === 'register';
    this.password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    for (const tab of this.root.querySelectorAll<HTMLButtonElement>('.auth-tab')) {
      tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
    }
    this.setError('');
    this.setBusy(false);
  }
}
