import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Import DatePipe
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { LendifyUser } from '../models';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe], // Add DatePipe
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss'
})
export class UserListComponent implements OnInit {
  private apiService = inject(ApiService);

  users = signal<LendifyUser[]>([]);
  isLoading = signal<boolean>(true);
  viewMode = signal<'active' | 'deleted'>('active'); // State to toggle view

  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  currentUserForm = signal<LendifyUser>({
        id: 0, name: '', studentId: '', email: '', role: 'student'
  });

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.isLoading.set(true);
    this.users.set([]); // Clear previous users
    try {
      let usersData;
      if (this.viewMode() === 'active') {
        usersData = await this.apiService.getUsers();
      } else {
        usersData = await this.apiService.getDeletedUsers();
      }
      this.users.set(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      alert("Failed to load users."); // Replace alert
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleViewMode() {
    this.viewMode.update(mode => mode === 'active' ? 'deleted' : 'active');
    this.loadUsers(); // Reload users based on the new mode
  }

  // --- Modal and Form Handling ---
  openModal(userToEdit?: LendifyUser) {
    if (userToEdit) {
      this.isEditing.set(true);
      this.currentUserForm.set({ ...userToEdit });
    } else {
      this.isEditing.set(false);
      this.resetCurrentUserForm();
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  updateCurrentUserForm(field: keyof LendifyUser, value: any) {
    this.currentUserForm.update(current => {
      const updatedUser = { ...current };
      // Use 'as any' for simplicity, or add specific type checks
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
        const { id, createdAt, deletedAt, ...newUserData } = userData; // Exclude properties not needed for creation
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

  async deleteUser(user: LendifyUser) { // Performs SOFT delete
    if (!confirm(`Are you sure you want to delete user "${user.name}" (${user.studentId})?`)) { // Replace confirm
      return;
    }
    try {
      await this.apiService.deleteUser(user.id);
      // Remove from the current view immediately
      this.users.update(users => users.filter(u => u.id !== user.id));
      alert("User deleted successfully (soft delete)."); // Replace alert
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user."); // Replace alert
    }
  }

  async recoverUser(user: LendifyUser) { // Recovers a user
     if (!confirm(`Are you sure you want to recover user "${user.name}" (${user.studentId})?`)) { // Replace confirm
      return;
    }
    try {
      await this.apiService.recoverUser(user.id);
       // Remove from the 'deleted' view immediately
      this.users.update(users => users.filter(u => u.id !== user.id));
      alert("User recovered successfully."); // Replace alert
    } catch (error) {
       console.error("Error recovering user:", error);
       alert("Failed to recover user."); // Replace alert
    }
  }

  // Helper to reset form
  private resetCurrentUserForm() {
     this.currentUserForm.set({
        id: 0, name: '', studentId: '', email: '', role: 'student'
      });
  }
}

