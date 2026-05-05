import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      fetchUser();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      // MS1 - Usuarios
      const res = await axios.get('http://localhost:5001/api/usuarios/auth/me');
      setUser(res.data.data);
      
      // Also check if user has voted via MS3
      const voteRes = await axios.get(`http://localhost:5003/api/votos/user/${res.data.data.id}`);
      setHasVoted(voteRes.data.has_voted);
    } catch (err) {
      console.error('Failed to fetch user', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (dni) => {
    try {
      const res = await axios.post('http://localhost:5001/api/usuarios/auth/login', { dni });
      setToken(res.data.token);
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Error de conexión' 
      };
    }
  };

  const logout = () => {
    setToken(null);
    setHasVoted(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, hasVoted, login, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
