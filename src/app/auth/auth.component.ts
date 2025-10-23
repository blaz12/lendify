import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

type AuthView = 'login' | 'register';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  authService = inject(AuthService);
  
  authView = signal<AuthView>('login');
  authError = signal<string | null>(null);

  async login(studentId: string, password: string) {
    this.authError.set(null); // Clear previous errors
    try {
      await this.authService.login(studentId, password);
      // Navigation is handled inside the authService on success
    } catch (err: any) {
      this.authError.set(err.message);
    }
  }

  async register(name: string, studentId: string, email: string, password: string) {
    this.authError.set(null); // Clear previous errors
    if (!name || !studentId || !email || !password) {
      this.authError.set("All registration fields are required.");
      return;
    }
    
    try {
      await this.authService.register(name, studentId, email, password);
      // On success, show a message and switch to login view
      this.authView.set('login');
      // We'll add a proper notification system later
      alert("Registration successful! Please log in.");
    } catch (err: any) {
      this.authError.set(err.message);
    }
  }
}

