import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import SuppliersPage from './pages/SuppliersPage'
import IncomingPage from './pages/IncomingPage'
import OutgoingPage from './pages/OutgoingPage'
import BookkeepingPage from './pages/BookkeepingPage'
import ActivityPage from './pages/ActivityPage'
import UsersPage from './pages/UsersPage'
import LoginPage from './pages/LoginPage'
import { apiService, TOKEN_KEY, USER_KEY } from './utils/api'
import { notifyError, notifySuccess } from './utils/toast'

const routeConfigs = [
  { key: 'dashboard', path: '/dashboard', element: <DashboardPage /> },
  { key: 'products', path: '/products', element: null },
  { key: 'suppliers', path: '/suppliers', element: <SuppliersPage /> },
  { key: 'incoming', path: '/incoming', element: null },
  { key: 'outgoing', path: '/outgoing', element: null },
  { key: 'bookkeeping', path: '/bookkeeping', element: null },
  { key: 'users', path: '/users', element: null },
  { key: 'activity', path: '/activity', element: <ActivityPage /> },
]

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [products, setProducts] = useState([])
  const [authLoading, setAuthLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const currentPage = useMemo(() => {
    const route = routeConfigs.find((item) => item.path === location.pathname)
    return route?.key || 'dashboard'
  }, [location.pathname])

  const handleLogout = useCallback((showMessage = true) => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setCurrentUser(null)
    setIsAuthenticated(false)
    setProducts([])
    navigate('/dashboard', { replace: true })
    if (showMessage) {
      notifySuccess('Berhasil logout')
    }
  }, [navigate])

  const verifySession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setAuthLoading(false)
      return
    }
    try {
      const { data } = await apiService.me()
      setCurrentUser(data.user)
      setIsAuthenticated(true)
    } catch (_error) {
      handleLogout(false)
    } finally {
      setAuthLoading(false)
    }
  }, [handleLogout])

  const loadProducts = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const perPage = 100
      let pageNumber = 1
      let totalPages = 1
      const collected = []

      while (pageNumber <= totalPages) {
        const { data } = await apiService.getProducts({ page: pageNumber, limit: perPage })
        collected.push(...(data.data || []))
        totalPages = data.meta?.total_pages || 1
        pageNumber += 1
      }

      setProducts(collected)
    } catch (error) {
      if (error?.response?.status === 401) {
        notifyError('Sesi login habis, silakan login ulang')
        handleLogout(false)
        return
      }
      notifyError(error.response?.data?.message || 'Gagal mengambil produk untuk form transaksi')
    }
  }, [handleLogout, isAuthenticated])

  useEffect(() => {
    verifySession()
  }, [verifySession])

  useEffect(() => {
    if (isAuthenticated) {
      loadProducts()
    }
  }, [isAuthenticated, loadProducts])

  const handleLogin = async (payload) => {
    try {
      setLoginLoading(true)
      const { data } = await apiService.login(payload)
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setCurrentUser(data.user)
      setIsAuthenticated(true)
      notifySuccess(`Selamat datang ${data.user.name}`)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      notifyError(error.response?.data?.message || 'Login gagal')
    } finally {
      setLoginLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        Memverifikasi sesi...
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onSubmit={handleLogin} loading={loginLoading} />
        <ToastContainer newestOnTop />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar page={currentPage} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="md:pl-72">
        <Topbar
          page={currentPage}
          onOpenSidebar={() => setSidebarOpen(true)}
          currentUser={currentUser}
          onLogout={() => handleLogout(true)}
        />
        <main className="p-4 sm:p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage onChanged={loadProducts} />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/incoming" element={<IncomingPage products={products} onChanged={loadProducts} />} />
            <Route path="/outgoing" element={<OutgoingPage products={products} onChanged={loadProducts} />} />
            <Route path="/bookkeeping" element={<BookkeepingPage onChanged={loadProducts} />} />
            <Route path="/users" element={<UsersPage currentUser={currentUser} />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      <ToastContainer newestOnTop />
    </div>
  )
}

export default App
