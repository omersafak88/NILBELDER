import { useState, useEffect } from 'react';
import { getSession } from './lib/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [session, setSession] = useState(getSession());

  useEffect(() => {
    const handleStorage = () => setSession(getSession());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!session) {
    return <Login onLogin={() => setSession(getSession())} />;
  }

  return <Dashboard session={session} onLogout={() => setSession(null)} />;
}

export default App;