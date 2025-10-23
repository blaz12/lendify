import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { LendifyUser } from '../models';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss'
})
export class UserListComponent implements OnInit {
  private apiService = inject(ApiService);

  // Signal to hold our list of users
  users = signal<LendifyUser[]>([]);
  isLoading = signal<boolean>(true);

  // State for the modal
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);

  // A signal to hold the user currently being edited or created
  currentUserForm = signal<LendifyUser>({
    id: 0,
    name: '',
    studentId: '',
    email: '',
    role: 'student'
  });

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.isLoading.set(true);
    try {
      const usersData = await this.apiService.getUsers();
      this.users.set(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      // Add user notification later
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Modal and Form Handling ---

  openModal(userToEdit?: LendifyUser) {
    if (userToEdit) {
      this.isEditing.set(true);
      // Set currentUserForm to a *copy* of the user to edit
      this.currentUserForm.set({ ...userToEdit });
    } else {
      this.isEditing.set(false);
      // Reset the form
      this.currentUserForm.set({
        id: 0,
        name: '',
        studentId: '',
        email: '',
        role: 'student'
      });
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  // Method to safely update fields in the form signal
  updateCurrentUserForm(field: keyof LendifyUser, value: any) {
    this.currentUserForm.update(current => {
      // Ensure we don't accidentally modify the original object
      const updatedUser = { ...current };

      // Update the specified field
      // We use 'as any' here because TypeScript might complain about assigning
      // a generic string/number to specific fields like 'role'.
      (updatedUser as any)[field] = value;

      return updatedUser;
    });
  }


  async saveUser() {
    const userData = this.currentUserForm();
    if (!userData.name || !userData.studentId || !userData.email) {
      alert("Please fill in Name, Student ID, and Email."); // Replace alert
      return;
    }

    try {
      if (this.isEditing()) {
        const updatedUser = await this.apiService.updateUser(userData);
        this.users.update(users =>
          users.map(user => user.id === updatedUser.id ? updatedUser : user)
        );
        alert("User updated successfully."); // Replace alert
      } else {
        // When creating, we don't send the ID.
        // The backend assigns a default password ('password123')
        const { id, ...newUserData } = userData;
        const createdUser = await this.apiService.createUser(newUserData);
        this.users.update(users => [...users, createdUser]);
        alert('User added successfully. Default password is "password123".'); // Replace alert
      }
      this.closeModal();

    } catch (error) {
      console.error("Error saving user:", error);
      alert("Failed to save user. Student ID or Email might already exist."); // Replace alert
    }
  }

  async deleteUser(user: LendifyUser) {
    if (!confirm(`Are you sure you want to delete user "${user.name}" (${user.studentId})?`)) { // Replace confirm
      return;
    }

    try {
      await this.apiService.deleteUser(user.id);
      this.users.update(users => users.filter(u => u.id !== user.id));
      alert("User deleted successfully."); // Replace alert
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user."); // Replace alert
    }
  }
}
