import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LendifyUser } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly apiBaseUrl = 'http://localhost:3000/api';

  // This is the global state! Any component can import this service
  // and read this signal to see who is logged in.
  currentUser = signal<LendifyUser | null>(null);

  constructor() { }

  async login(studentId: string, password: string): Promise<LendifyUser> {
    try {
      const user = await firstValueFrom(this.http.post<LendifyUser>(`${this.apiBaseUrl}/login`, { studentId, password }));
      if (user) {
        this.currentUser.set(user); // Set the global state
        await this.router.navigate(['/dashboard']); // Navigate to dashboard on success
        return user;
      }
      throw new Error('Login failed');
    } catch (err) {
      console.error('Login error', err);
      // Rethrow the error so the component can catch it
      throw this.handleApiError(err, 'Login failed. Please check your credentials.');
    }
  }

  async register(name: string, studentId: string, email: string, password: string): Promise<LendifyUser> {
    try {
      const user = await firstValueFrom(this.http.post<LendifyUser>(`${this.apiBaseUrl}/register`, { name, studentId, email, password }));
      return user;
    } catch (err) {
      console.error('Registration error', err);
      throw this.handleApiError(err, 'Registration failed.');
    }
  }

  async logout() {
    this.currentUser.set(null); // Clear the global state
    await this.router.navigate(['/auth']); // Go back to login page
  }

  private handleApiError(error: any, defaultMessage: string): Error {
    let errorMessage = defaultMessage;
    if (error instanceof HttpErrorResponse && error.error?.error) {
      errorMessage = error.error.error;
    }
    return new Error(errorMessage);
  }
}
