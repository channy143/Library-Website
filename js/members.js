// Members Data Management - Database Integration
const API_BASE = 'api';
let members = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadMembers();
    renderMembers();
    setupSearch();
});

// Load members from database
async function loadMembers() {
    try {
        const response = await fetch(`${API_BASE}/auth?action=list`);
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            members = result.data.map(user => ({
                id: user.id,
                fullName: user.full_name || user.username,
                email: user.email,
                joinDate: user.created_at ? user.created_at.split(' ')[0] : new Date().toISOString().split('T')[0],
                status: user.status === 'suspended' ? 'Inactive' : 'Active',
                role: user.role === 'admin' || user.role === 'staff' ? 'Staff' : 'Member',
                stats: user.stats || {}
            }));
        }
    } catch (error) {
        console.error('Failed to load members:', error);
        members = [];
    }
}

// Render Members Table
function renderMembers(membersToRender = members) {
    const tableBody = document.getElementById('membersTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (membersToRender.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-gray); padding: 40px;">No members found</td></tr>';
        return;
    }

    membersToRender.forEach(member => {
        const row = document.createElement('tr');
        const initials = member.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        row.innerHTML = `
            <td>
                <div class="member-info">
                    <div class="member-avatar">${initials}</div>
                    <span>${member.fullName}</span>
                </div>
            </td>
            <td>${member.email}</td>
            <td>${formatDate(member.joinDate)}</td>
            <td>
                <span class="status-badge ${member.status === 'Active' ? 'status-active' : 'status-inactive'}">
                    ${member.status}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" onclick="editMember(${member.id})" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn delete" onclick="deleteMember(${member.id})" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Helper: Format Date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Modal Functions
let editingMemberId = null;

function openAddMemberModal() {
    const modal = document.getElementById('memberModal');
    modal.classList.add('active');
    document.getElementById('memberForm').reset();
    document.getElementById('modalTitle').textContent = 'Add New Member';
    editingMemberId = null;
}

function closeMemberModal() {
    const modal = document.getElementById('memberModal');
    modal.classList.remove('active');
    editingMemberId = null;
}

// Handle Form Submit
async function handleMemberSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const userData = {
        full_name: formData.get('fullName'),
        email: formData.get('email'),
        role: formData.get('role') === 'Staff' ? 'staff' : 'user',
        username: formData.get('email').split('@')[0] // Generate username from email
    };

    try {
        if (editingMemberId) {
            // Update existing user
            const response = await fetch(`${API_BASE}/auth?id=${editingMemberId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const result = await response.json();
            if (!result.success) {
                alert(result.message || 'Failed to update member');
                return;
            }
        } else {
            // Create new user via register endpoint
            const registerData = {
                username: userData.username,
                email: userData.email,
                password: 'temp123456', // Temporary password
                fullName: userData.full_name,
                role: userData.role
            };
            const response = await fetch(`${API_BASE}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerData)
            });
            const result = await response.json();
            if (!result.success) {
                alert(result.error || 'Failed to add member');
                return;
            }
        }

        await loadMembers();
        renderMembers();
        closeMemberModal();
    } catch (error) {
        console.error('Error saving member:', error);
        alert('Failed to save member');
    }
}

// Delete Member
async function deleteMember(id) {
    if (!confirm('Are you sure you want to delete this member?')) return;

    try {
        const response = await fetch(`${API_BASE}/auth?id=${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            await loadMembers();
            renderMembers();
        } else {
            alert(result.message || 'Failed to delete member');
        }
    } catch (error) {
        console.error('Error deleting member:', error);
        alert('Failed to delete member');
    }
}

// Search Functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = members.filter(member =>
            member.fullName.toLowerCase().includes(term) ||
            member.email.toLowerCase().includes(term)
        );
        renderMembers(filtered);
    });
}

// Edit Member
async function editMember(id) {
    const member = members.find(m => m.id === id);
    if (!member) return;

    editingMemberId = id;
    const modal = document.getElementById('memberModal');
    const form = document.getElementById('memberForm');

    document.getElementById('modalTitle').textContent = 'Edit Member';

    // Populate form
    const fullNameInput = form.querySelector('[name="fullName"]');
    const emailInput = form.querySelector('[name="email"]');
    const roleInput = form.querySelector('[name="role"]');
    const statusInput = form.querySelector('[name="status"]');

    if (fullNameInput) fullNameInput.value = member.fullName;
    if (emailInput) emailInput.value = member.email;
    if (roleInput) roleInput.value = member.role;
    if (statusInput) statusInput.value = member.status;

    modal.classList.add('active');
}
