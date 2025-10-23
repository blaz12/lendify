// Inside auth.component.ts

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service'; // Ensure this path is correct

type AuthView = 'login' | 'register';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule], // Make sure CommonModule is imported
  templateUrl: './auth.component.html'
  // No styleUrl needed if the .scss file was deleted or not used
})
export class AuthComponent {
  // Inject AuthService correctly
  private authService = inject(AuthService);
  authView = signal<AuthView>('login');
  authError = signal<string | null>(null);

  async login(studentId: string, password: string) {
    console.log('Login button clicked!', { studentId, password }); // Log 1: Function starts

    if (!studentId || !password) {
      console.log('Login aborted: Missing studentId or password.'); // Log 2: Aborted early
      this.authError.set("Student ID and password are required.");
      return;
    }

    try {
      this.authError.set(null); // Clear previous errors
      console.log('Attempting to call authService.login...'); // Log 3: Before service call

      // Call the AuthService's login method
      const user = await this.authService.login(studentId, password);

      console.log('authService.login completed. User:', user); // Log 4: After service call (if successful)

      // The AuthService should handle navigation/state update upon success.
      // If not, you might need to handle it here. For now, we just log.
      if (user) {
         console.log('Login seems successful based on service response.');
      } else {
         // This case shouldn't happen if the service throws errors correctly
         console.warn('authService.login returned but no user data received.');
         this.authError.set("Login failed. Unexpected response from server.");
      }

    } catch (error) {
      // --- IMPORTANT: Log the actual error object ---
      console.error('Error during login attempt:', error); // Log 5: Catch block entered
      // --- END IMPORTANT ---

      // Display a user-friendly error message based on the error caught by AuthService
      // AuthService should set its own error signal or return specific error info
      // For now, we use the signal from AuthService if available, or a generic message
      this.authError.set(this.authService.authError() || "Login failed. Please check credentials or server connection.");
    }
  }

  async register(name: string, studentId: string, email: string, password: string) {
    console.log('Register button clicked!', { name, studentId, email }); // Basic log for register

     if (!name || !studentId || !email || !password) {
        this.authError.set("All registration fields are required.");
        return;
     }

     try {
        this.authError.set(null); // Clear previous errors
        console.log('Attempting to call authService.register...');

        await this.authService.register(name, studentId, email, password);

        console.log('authService.register completed.');
        // AuthService should handle success notification/redirect logic
        // For now, just switch view
        alert('Registration successful! Please log in.'); // Replace alert later
        this.authView.set('login');


     } catch (error) {
        console.error('Error during registration attempt:', error);
        this.authError.set(this.authService.authError() || "Registration failed.");
     }
  }
}