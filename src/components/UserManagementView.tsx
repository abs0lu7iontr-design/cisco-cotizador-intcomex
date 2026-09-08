// ============================================================================
// CISCO AUTOMATED v3.3 - RBAC USER MANAGEMENT (ADMIN PANEL)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { UserRecord, Role } from '../core/types';
import {
  Users,
  UserPlus,
  KeyRound,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
  Mail,
  User,
  AlertCircle,
  UserCog,
  Edit3,
  Search,
  Power,
  Check,
  X,
  Cloud,
} from 'lucide-react';
import {
  getCloudUsers,
  saveCloudUser,
  deleteCloudUser,
  sha256Salted,
  CloudUserRecord,
} from '../modules/cloud';

export function UserManagementView() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUserForAction, setSelectedUserForAction] = useState<UserRecord | null>(null);

  // Form States - Create
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Intcomex2026!');
  const [newRole, setNewRole] = useState<Role>('pm');

  // Form States - Edit Full User
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<Role>('pm');
  const [editPassword, setEditPassword] = useState('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Form States - Quick Actions
  const [resetPasswordVal, setResetPasswordVal] = useState('Intcomex2026!');
  const [targetRole, setTargetRole] = useState<Role>('pm');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      if ((window as any).pywebview?.api?.get_users) {
        const res = await (window as any).pywebview.api.get_users();
        if (res && res.success && res.users) {
          setUsers(res.users);
          return;
        }
      }

      // Cloud & Offline Local Cache Sync
      const cloudRes = await getCloudUsers();
      if (cloudRes.success && cloudRes.data) {
        setUsers(cloudRes.data as UserRecord[]);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newFullName.trim() || !newEmail.trim() || !newPassword) {
      showToast('Por favor completa todos los campos requeridos.', 'error');
      return;
    }

    try {
      if ((window as any).pywebview?.api?.create_user_admin) {
        const res = await (window as any).pywebview.api.create_user_admin(
          newUsername.trim(),
          newFullName.trim(),
          newEmail.trim(),
          newPassword,
          newRole
        );
        if (res && res.success) {
          showToast(`Usuario '${newUsername}' creado con rol ${newRole.toUpperCase()}.`);
          setShowCreateModal(false);
          setNewUsername('');
          setNewFullName('');
          setNewEmail('');
          fetchUsers();
          return;
        } else {
          showToast(res?.message || 'Error creando usuario.', 'error');
          return;
        }
      }

      // Cloud Firestore + Local Cache creation
      const hash = await sha256Salted(newPassword);
      const newUserRecord: CloudUserRecord = {
        username: newUsername.trim().toLowerCase(),
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        role: newRole,
        password_hash: hash,
        is_active: 1,
        created_at: new Date().toISOString(),
      };

      const res = await saveCloudUser(newUserRecord);
      if (res.success) {
        showToast(`Usuario '${newUsername}' guardado exitosamente en la nube y listo para uso local.`);
        setShowCreateModal(false);
        setNewUsername('');
        setNewFullName('');
        setNewEmail('');
        fetchUsers();
      } else {
        showToast(`Aviso: ${res.error || 'Guardado local'}`, 'error');
        fetchUsers();
      }
    } catch (err: any) {
      showToast('Error: ' + err?.message, 'error');
    }
  };

  const handleOpenEditModal = (user: UserRecord) => {
    setSelectedUserForAction(user);
    setEditFullName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'pm');
    setEditPassword('');
    setEditIsActive(user.is_active !== 0);
    setShowEditModal(true);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAction) return;

    if (!editFullName.trim() || !editEmail.trim()) {
      showToast('Nombre completo y Correo son obligatorios.', 'error');
      return;
    }

    try {
      if ((window as any).pywebview?.api?.update_user_admin) {
        const res = await (window as any).pywebview.api.update_user_admin(
          selectedUserForAction.username,
          editFullName.trim(),
          editEmail.trim(),
          editRole,
          editPassword.trim() || null,
          editIsActive
        );
        if (res && res.success) {
          showToast(res.message);
          setShowEditModal(false);
          fetchUsers();
          return;
        } else {
          showToast(res?.message || 'Error actualizando usuario.', 'error');
          return;
        }
      }

      // Cloud Firestore + Local Cache Update
      let passwordHash = (selectedUserForAction as any).password_hash;
      if (editPassword.trim()) {
        passwordHash = await sha256Salted(editPassword.trim());
      } else if (!passwordHash) {
        passwordHash = await sha256Salted('Intcomex2026!');
      }

      const updatedRecord: CloudUserRecord = {
        username: selectedUserForAction.username.toLowerCase(),
        full_name: editFullName.trim(),
        email: editEmail.trim(),
        role: editRole,
        password_hash: passwordHash,
        is_active: editIsActive ? 1 : 0,
        created_at: selectedUserForAction.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveCloudUser(updatedRecord);
      showToast(`Usuario '${selectedUserForAction.username}' actualizado en la nube.`);
      setShowEditModal(false);
      fetchUsers();
    } catch (err: any) {
      showToast('Error: ' + err?.message, 'error');
    }
  };

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAction) return;

    try {
      if ((window as any).pywebview?.api?.update_user_role_admin) {
        const res = await (window as any).pywebview.api.update_user_role_admin(
          selectedUserForAction.username,
          targetRole
        );
        if (res && res.success) {
          showToast(res.message);
          setShowRoleModal(false);
          fetchUsers();
          return;
        } else {
          showToast(res?.message || 'Error cambiando rol.', 'error');
          return;
        }
      }

      // Cloud update
      const updatedRecord: CloudUserRecord = {
        username: selectedUserForAction.username.toLowerCase(),
        full_name: selectedUserForAction.full_name,
        email: selectedUserForAction.email,
        role: targetRole,
        password_hash: (selectedUserForAction as any).password_hash || (await sha256Salted('Intcomex2026!')),
        is_active: selectedUserForAction.is_active ?? 1,
        created_at: selectedUserForAction.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveCloudUser(updatedRecord);
      showToast(`Rol de '${selectedUserForAction.username}' actualizado a ${targetRole.toUpperCase()}.`);
      setShowRoleModal(false);
      fetchUsers();
    } catch (err: any) {
      showToast('Error: ' + err?.message, 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAction) return;
    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    try {
      if ((window as any).pywebview?.api?.reset_password_admin) {
        const res = await (window as any).pywebview.api.reset_password_admin(
          selectedUserForAction.username,
          resetPasswordVal
        );
        if (res && res.success) {
          showToast(`Contraseña de '${selectedUserForAction.username}' reseteada con éxito.`);
          setShowResetModal(false);
          return;
        } else {
          showToast(res?.message || 'Error reseteando contraseña.', 'error');
          return;
        }
      }

      // Cloud password hash reset
      const newHash = await sha256Salted(resetPasswordVal);
      const updatedRecord: CloudUserRecord = {
        username: selectedUserForAction.username.toLowerCase(),
        full_name: selectedUserForAction.full_name,
        email: selectedUserForAction.email,
        role: selectedUserForAction.role,
        password_hash: newHash,
        is_active: selectedUserForAction.is_active ?? 1,
        created_at: selectedUserForAction.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveCloudUser(updatedRecord);
      showToast(`Contraseña reseteada exitosamente para '${selectedUserForAction.username}'.`);
      setShowResetModal(false);
      fetchUsers();
    } catch (err: any) {
      showToast('Error: ' + err?.message, 'error');
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    if (user.username === 'mskill') {
      showToast('No puedes desactivar la cuenta de Administrador principal (mskill).', 'error');
      return;
    }

    const nextState = user.is_active === 0;
    try {
      if ((window as any).pywebview?.api?.toggle_user_status_admin) {
        const res = await (window as any).pywebview.api.toggle_user_status_admin(
          user.username,
          nextState
        );
        if (res && res.success) {
          showToast(res.message);
          fetchUsers();
          return;
        } else {
          showToast(res?.message || 'Error cambiando estado.', 'error');
          return;
        }
      }

      // Cloud status toggle
      const updatedRecord: CloudUserRecord = {
        username: user.username.toLowerCase(),
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        password_hash: (user as any).password_hash || (await sha256Salted('Intcomex2026!')),
        is_active: nextState ? 1 : 0,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveCloudUser(updatedRecord);
      showToast(
        nextState
          ? `Cuenta '${user.username}' reactivada exitosamente.`
          : `Cuenta '${user.username}' deshabilitada (historial conservado).`
      );
      fetchUsers();
    } catch (err: any) {
      showToast('Error: ' + err?.message, 'error');
    }
  };

  const getRoleBadge = (role: Role) => {
    if (role === 'admin') {
      return 'bg-rose-950/70 text-rose-300 border-rose-700/40';
    }
    if (role === 'pm') {
      return 'bg-emerald-950/70 text-emerald-300 border-emerald-700/40';
    }
    return 'bg-indigo-950/70 text-indigo-300 border-indigo-700/40';
  };

  const getRoleLabel = (role: Role) => {
    if (role === 'admin') return 'ADMINISTRADOR';
    if (role === 'pm') return 'PRODUCT MANAGER (PM)';
    return 'PREVENTA';
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-xs font-bold shadow-2xl flex items-center space-x-2 animate-slide-up ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border border-emerald-500/50'
              : 'bg-rose-950 text-rose-200 border border-rose-500/50'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>Gestión y Control de Usuarios (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Administra credenciales, nombres, roles, y activación/expiración conservando el historial de cotizaciones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="Recargar usuarios"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, usuario, correo o rol..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
        <div className="text-xs text-slate-400 font-semibold">
          Total: <strong className="text-white">{filteredUsers.length}</strong> usuarios
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <th className="py-3.5 px-4">Usuario / Nombre Completo</th>
                <th className="py-3.5 px-4">Rol en Plataforma</th>
                <th className="py-3.5 px-4">Correo Corporativo</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones de Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No se encontraron usuarios registrados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.is_active !== 0;
                  return (
                    <tr
                      key={u.username}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !isActive ? 'opacity-60 bg-slate-950/50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                              u.role === 'admin'
                                ? 'bg-rose-500/20 text-rose-300'
                                : u.role === 'pm'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-indigo-500/20 text-indigo-300'
                            }`}
                          >
                            {u.username.substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {u.username === 'mskill' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-950 text-rose-300 border border-rose-800/50 font-bold">
                                  Root Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${getRoleBadge(
                            u.role
                          )}`}
                        >
                          {getRoleLabel(u.role)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
                        {u.email}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            <span>Deshabilitado</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Complete Edit Button */}
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                            title="Editar nombre, correo, rol y clave"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                          </button>

                          {/* Reset Password Button */}
                          <button
                            onClick={() => {
                              setSelectedUserForAction(u);
                              setResetPasswordVal('Intcomex2026!');
                              setShowResetModal(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                            title="Cambiar contraseña"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          {/* Change Role Button */}
                          {u.username !== 'mskill' && (
                            <button
                              onClick={() => {
                                setSelectedUserForAction(u);
                                setTargetRole(u.role);
                                setShowRoleModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                              title="Cambiar rol"
                            >
                              <Shield className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                          )}

                          {/* Toggle Active/Disabled Button */}
                          {u.username !== 'mskill' && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isActive
                                  ? 'bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border-rose-800/40'
                                  : 'bg-emerald-950/40 hover:bg-emerald-950/80 text-emerald-300 border-emerald-800/40'
                              }`}
                              title={isActive ? 'Deshabilitar cuenta (mantiene historial)' : 'Reactivar cuenta'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: EDIT FULL USER */}
      {showEditModal && selectedUserForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
                <Edit3 className="w-5 h-5" />
                <span>Editar Usuario &bull; @{selectedUserForAction.username}</span>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Rol en Plataforma
                </label>
                <select
                  disabled={selectedUserForAction.username === 'mskill'}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  <option value="pm">Product Manager (PM)</option>
                  <option value="preventa">Preventa</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Nueva Contraseña (Opcional - dejar vacío si no cambia)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Dejar en blanco para mantener actual"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              {selectedUserForAction.username !== 'mskill' && (
                <div className="pt-2">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-0"
                    />
                    <span className="text-slate-300 font-semibold text-xs">
                      Cuenta Habilitada (Desmarcar para deshabilitar conservando historial)
                    </span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
                <UserPlus className="w-5 h-5" />
                <span>Registrar Nuevo Usuario</span>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Nombre de Usuario (Login)
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="ej: jgonzalez"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="ej: Juan González"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Correo Corporativo
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jgonzalez@intcomex.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Rol en Plataforma
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500"
                >
                  <option value="pm">Product Manager (PM)</option>
                  <option value="preventa">Preventa</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Contraseña Inicial
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {showResetModal && selectedUserForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <KeyRound className="w-5 h-5" />
                <span>Restablecer Contraseña &bull; @{selectedUserForAction.username}</span>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Nueva Contraseña para {selectedUserForAction.full_name}
                </label>
                <input
                  type="text"
                  required
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/30"
                >
                  Actualizar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE ROLE */}
      {showRoleModal && selectedUserForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <Shield className="w-5 h-5" />
                <span>Asignar Rol &bull; @{selectedUserForAction.username}</span>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeRole} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Seleccionar Rol
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as Role)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-emerald-500"
                >
                  <option value="pm">Product Manager (PM)</option>
                  <option value="preventa">Preventa</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/30"
                >
                  Confirmar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
