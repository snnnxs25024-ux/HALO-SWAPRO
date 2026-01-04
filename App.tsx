import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole, AppState, Client, Employee, Message, Chat, Payslip, DataEntry, DataStatus } from './types.ts';
import Landing from './pages/Landing.tsx';
import Login from './pages/Login.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Sidebar from './components/Sidebar.tsx';
import Database from './pages/Database.tsx';
import ChatPage from './pages/ChatPage.tsx';
import ClientManagement from './pages/ClientManagement.tsx';
import { generateChatReply } from './services/geminiService.ts';
import PublicSearch from './pages/PublicSearch.tsx';
import PayslipPage from './pages/PayslipPage.tsx';
import Discussion from './pages/Discussion.tsx';
import { supabase } from './services/supabaseClient.ts';
import { Loader } from 'lucide-react';
import { useNotifier } from './components/Notifier.tsx';

// --- MOCK USER DATA (Authentication kept local) ---
const MOCK_PIC_USER: User[] = [
  { id: 'pic-1', nama: 'PIC Swakarya', role: UserRole.PIC, avatar: 'https://i.imgur.com/P7t1bQy.png' },
];
const MOCK_ADMIN_USER: User = { id: 'admin-1', nama: 'Admin SWAPRO', role: UserRole.ADMIN, avatar: 'https://i.imgur.com/8z2b2iP.png' };
// FIX: Add a guest user for public-facing components that require a user prop.
const MOCK_GUEST_USER: User = { id: 'guest', nama: 'Guest', role: UserRole.KARYAWAN };


const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    clients: [],
    employees: [],
    employeeChats: {},
    payslips: [],
    dataEntries: [],
    discussionChats: {},
  });
  const [loading, setLoading] = useState(true);
  const notifier = useNotifier();

  // --- DATA FETCHING FROM SUPABASE ---
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [
          { data: clientsData, error: clientsError },
          { data: employeesData, error: employeesError },
          { data: payslipsData, error: payslipsError }
        ] = await Promise.all([
          supabase.from('clients').select('*'),
          supabase.from('employees').select('*'),
          supabase.from('payslips').select('*'),
        ]);

        if (clientsError) throw clientsError;
        if (employeesError) throw employeesError;
        if (payslipsError) throw payslipsError;

        setState(prev => ({
          ...prev,
          clients: clientsData || [],
          employees: employeesData || [],
          payslips: payslipsData || []
        }));
      } catch (error: any) {
        console.error("Error fetching initial data from Supabase:", error);
        notifier.addNotification(`Gagal memuat data awal: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [notifier]);
  
  // --- AUTHENTICATION (kept local) ---
  const handlePicLogin = (userId: string): boolean => {
    const user = MOCK_PIC_USER.find(u => u.id === userId) || null;
    if (user) {
      setState(prev => ({ ...prev, currentUser: user }));
      notifier.addNotification(`Selamat datang, ${user.nama}!`, 'success');
      return true;
    }
    return false;
  };
  
  const logout = () => {
    notifier.addNotification('Anda telah berhasil logout.', 'info');
    setState(prev => ({ ...prev, currentUser: null }));
  };
  
  // --- CRUD OPERATIONS FOR EMPLOYEES ---
  const handleEmployeeDataChange = async (employeesToUpsert: Partial<Employee>[]) => {
    const employeeMap = new Map(state.employees.map(emp => [emp.id, emp]));

    // Perform a deep merge client-side to correctly handle partial updates to JSONB columns
    const recordsToUpsert = employeesToUpsert.map(partialEmp => {
        if (!partialEmp.id) return null; // Should not happen if CSV parsing is correct
        const existingEmp = employeeMap.get(partialEmp.id) || {};
        
        const mergedEmp: Employee = {
            ...(existingEmp as Employee),
            ...partialEmp,
            // FIX: Safely merge nested bankAccount object, guarding against null values from the database which cannot be spread.
            bankAccount: {
                ...((existingEmp as any).bankAccount || {}),
                ...(partialEmp.bankAccount || {}),
            },
            // FIX: Safely merge nested bpjs object, guarding against null values from the database which cannot be spread.
            bpjs: {
                ...((existingEmp as any).bpjs || {}),
                ...(partialEmp.bpjs || {}),
            },
            // FIX: Safely merge nested documents object, guarding against null values from the database which cannot be spread.
            documents: {
                ...((existingEmp as any).documents || {}),
                ...(partialEmp.documents || {}),
            }
        };
        return mergedEmp;
    }).filter((e): e is Employee => e !== null);

    if (recordsToUpsert.length === 0) {
        notifier.addNotification("Tidak ada data valid untuk diimpor.", "info");
        return;
    }

    const { data: upsertedData, error } = await supabase.from('employees').upsert(recordsToUpsert).select();

    if (error) {
        notifier.addNotification(`Impor massal gagal: ${error.message}`, 'error');
        return;
    }

    if (upsertedData) {
        const updatedEmployeeMap = new Map(state.employees.map(emp => [emp.id, emp]));
        upsertedData.forEach(dbEmp => updatedEmployeeMap.set(dbEmp.id, dbEmp as Employee));
        const finalEmployeeList = Array.from(updatedEmployeeMap.values());

        setState(prev => ({ ...prev, employees: finalEmployeeList }));
        notifier.addNotification(`${recordsToUpsert.length} baris data karyawan berhasil diimpor/diperbarui.`, 'success');
    }
  };


  const addEmployee = async (employee: Employee) => {
    const { data, error } = await supabase.from('employees').insert([employee]).select();
    if (error) {
      console.error("Error adding employee:", error);
      notifier.addNotification(`Gagal menambahkan karyawan: ${error.message}`, 'error');
      return;
    }
    if (data) {
      setState(prev => ({ ...prev, employees: [data[0], ...prev.employees]}));
      notifier.addNotification('Karyawan baru berhasil ditambahkan.', 'success');
    }
  };

  const updateEmployee = async (employee: Employee) => {
    const { data, error } = await supabase.from('employees').update(employee).eq('id', employee.id).select();
    if (error) {
      console.error("Error updating employee:", error);
      notifier.addNotification(`Gagal memperbarui karyawan: ${error.message}`, 'error');
      return;
    }
    if (data) {
        setState(prev => ({
            ...prev,
            employees: prev.employees.map(e => e.id === employee.id ? data[0] : e)
        }));
        notifier.addNotification('Data karyawan berhasil diperbarui.', 'success');
    }
  };

  const deleteEmployee = async (employeeId: string) => {
    const { error } = await supabase.from('employees').delete().eq('id', employeeId);
     if (error) {
      console.error("Error deleting employee:", error);
      notifier.addNotification(`Gagal menghapus karyawan: ${error.message}`, 'error');
      return;
    }
    setState(prev => ({...prev, employees: prev.employees.filter(e => e.id !== employeeId)}));
    notifier.addNotification('Karyawan berhasil dihapus.', 'success');
  };

  // --- REFACTORED CRUD FOR CLIENTS ---
  const addClient = async (client: Client) => {
    const { data, error } = await supabase.from('clients').insert([client]).select();
    if (error) {
        notifier.addNotification(`Gagal menambahkan klien: ${error.message}`, 'error');
        return;
    }
    if (data) {
        setState(prev => ({ ...prev, clients: [data[0], ...prev.clients] }));
        notifier.addNotification('Klien baru berhasil ditambahkan.', 'success');
    }
  };

  const updateClient = async (client: Client) => {
    const { data, error } = await supabase.from('clients').update(client).eq('id', client.id).select();
    if (error) {
        notifier.addNotification(`Gagal memperbarui klien: ${error.message}`, 'error');
        return;
    }
    if (data) {
        setState(prev => ({ ...prev, clients: prev.clients.map(c => c.id === client.id ? data[0] : c) }));
        notifier.addNotification('Data klien berhasil diperbarui.', 'success');
    }
  };

  // FIX: Added missing client deletion logic.
  const deleteClient = async (clientId: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) {
        notifier.addNotification(`Gagal menghapus klien: ${error.message}`, 'error');
        return;
    }
    setState(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== clientId) }));
    notifier.addNotification('Klien berhasil dihapus.', 'success');
  };

  // FIX: Added payslip update handler for PayslipPage.
  const handlePayslipsChange = async (payslipsToUpsert: Payslip[]) => {
    const { data, error } = await supabase.from('payslips').upsert(payslipsToUpsert).select();
    if (error) {
        notifier.addNotification(`Gagal mengunggah slip gaji: ${error.message}`, 'error');
        return;
    }
    if (data) {
        const updatedPayslipMap = new Map(state.payslips.map(p => [p.id, p]));
        data.forEach(p => updatedPayslipMap.set(p.id, p as Payslip));
        setState(prev => ({ ...prev, payslips: Array.from(updatedPayslipMap.values()) }));
        notifier.addNotification(`${data.length} slip gaji berhasil diunggah/diperbarui.`, 'success');
    }
  };

  // FIX: Added handlers for ChatPage functionality.
  const updateEmployeeChats = (updatedChats: Record<string, Chat>) => {
    setState(prev => ({ ...prev, employeeChats: updatedChats }));
  };
  
  const handleGenerateReply = async (employeeId: string, currentChat: Chat) => {
    const employee = state.employees.find(e => e.id === employeeId);
    if (!employee || !state.currentUser) return;

    setState(prev => ({
        ...prev,
        employeeChats: { ...prev.employeeChats, [employeeId]: { ...currentChat, isTyping: true } }
    }));

    try {
        const replyText = await generateChatReply(currentChat.messages, employee.fullName, state.currentUser.nama);
        const replyMessage: Message = {
            id: `msg-${Date.now()}`,
            senderId: employeeId,
            text: replyText,
            timestamp: new Date().toISOString(),
        };

        setState(prev => ({
            ...prev,
            employeeChats: {
                ...prev.employeeChats,
                [employeeId]: {
                    messages: [...(prev.employeeChats[employeeId]?.messages || []), replyMessage],
                    isTyping: false
                }
            }
        }));
    } catch (error) {
        console.error("Error generating AI reply:", error);
        setState(prev => ({
            ...prev,
            employeeChats: { ...prev.employeeChats, [employeeId]: { ...currentChat, isTyping: false } }
        }));
    }
  };

  // FIX: Added handlers for Discussion page.
  const updateDiscussionData = (dataEntries: DataEntry[], chats: Record<string, Chat>) => {
    setState(prev => ({ ...prev, dataEntries, discussionChats: chats }));
  };

  const handleDiscussionAdminReply = (entry: DataEntry, userMessage: Message) => {
      // For now, this just simulates an admin reply.
      const adminReply: Message = {
          id: `msg-admin-${Date.now()}`,
          senderId: MOCK_ADMIN_USER.id,
          text: "Terima kasih atas laporan Anda. Kami akan segera menindaklanjutinya.",
          timestamp: new Date().toISOString(),
      };
      setState(prev => ({
          ...prev,
          discussionChats: {
              ...prev.discussionChats,
              [entry.id]: {
                  ...prev.discussionChats[entry.id],
                  messages: [...(prev.discussionChats[entry.id]?.messages || []), adminReply]
              }
          }
      }));
  };
  
  // FIX: Added loading state display.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  // FIX: Added main router and view logic, which was missing.
  return (
    <HashRouter>
      {state.currentUser ? (
        <div className="flex h-screen bg-slate-50">
          <Sidebar user={state.currentUser} onLogout={logout} />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard state={state} />} />
              <Route path="/database" element={<Database employees={state.employees} clients={state.clients} payslips={state.payslips} onDataChange={handleEmployeeDataChange} onAddEmployee={addEmployee} onUpdateEmployee={updateEmployee} onDeleteEmployee={deleteEmployee} currentUser={state.currentUser} />} />
              <Route path="/clients" element={<ClientManagement clients={state.clients} employees={state.employees} onAddClient={addClient} onUpdateClient={updateClient} onDeleteClient={deleteClient} />} />
              <Route path="/payslips" element={<PayslipPage payslips={state.payslips} employees={state.employees} clients={state.clients} onPayslipsChange={handlePayslipsChange} />} />
              <Route path="/chat" element={<ChatPage employees={state.employees} currentUser={state.currentUser} chats={state.employeeChats} onUpdate={updateEmployeeChats} onGenerateReply={handleGenerateReply} />} />
              {/* Note: Discussion page is not linked in sidebar, but route is available */}
              <Route path="/discussion" element={<Discussion dataEntries={state.dataEntries} chats={state.discussionChats} currentUser={state.currentUser} adminUser={MOCK_ADMIN_USER} onUpdate={updateDiscussionData} onAdminReply={handleDiscussionAdminReply} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login onPicLogin={handlePicLogin} picUsers={MOCK_PIC_USER} />} />
          <Route path="/search" element={<PublicSearch employees={state.employees} clients={state.clients} payslips={state.payslips} currentUser={MOCK_GUEST_USER} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      )}
    </HashRouter>
  );
};

// FIX: Added the missing default export for the App component.
export default App;
