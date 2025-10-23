import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; // Import HttpClient provider

import { routes } from './app.routes'; // Import your routes

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),      // Sets up the router with your defined routes
    provideHttpClient()       // Enables the HttpClient service for making API calls
  ]
};

