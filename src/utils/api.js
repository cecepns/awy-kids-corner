import axios from 'axios'

export const TOKEN_KEY = 'awy_kids_corner_token'
export const USER_KEY = 'awy_kids_corner_user'

const api = axios.create({
  // baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  baseURL: "https://api-inventory.isavralabel.com/awy-kids-corner/api",
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const apiService = {
  login: (payload) => api.post('/auth/login', payload),
  me: () => api.get('/auth/me'),

  getDashboard: () => api.get('/dashboard'),
  getUsers: (params) => api.get('/users', { params }),
  createUser: (payload) => api.post('/users', payload),
  updateUser: (id, payload) => api.put(`/users/${id}`, payload),
  deleteUser: (id) => api.delete(`/users/${id}`),

  getSuppliers: (params) => api.get('/suppliers', { params }),
  createSupplier: (payload) => api.post('/suppliers', payload),
  updateSupplier: (id, payload) => api.put(`/suppliers/${id}`, payload),
  deleteSupplier: (id) => api.delete(`/suppliers/${id}`),

  getProducts: (params) => api.get('/products', { params }),
  getProductCost: (id) => api.get(`/products/${id}/cost`),
  createProduct: (payload) => api.post('/products', payload),
  updateProduct: (id, payload) => api.put(`/products/${id}`, payload),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  bulkInsertProducts: (payload) => api.post('/products/bulk', payload),

  getIncoming: (params) => api.get('/incoming', { params }),
  createIncoming: (payload) => api.post('/incoming', payload),
  updateIncoming: (id, payload) => api.put(`/incoming/${id}`, payload),
  deleteIncoming: (id) => api.delete(`/incoming/${id}`),

  getOutgoing: (params) => api.get('/outgoing', { params }),
  createOutgoing: (payload) => api.post('/outgoing', payload),
  updateOutgoing: (id, payload) => api.put(`/outgoing/${id}`, payload),
  deleteOutgoing: (id) => api.delete(`/outgoing/${id}`),

  getBookkeeping: (params) => api.get('/bookkeeping', { params }),
  updateBookkeeping: (payload) => api.post('/bookkeeping', payload),

  getActivity: (params) => api.get('/activity', { params }),
}

export default api
