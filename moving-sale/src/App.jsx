import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Banner from './components/Banner.jsx'
import Storefront from './pages/Storefront.jsx'
import ItemPage from './pages/ItemPage.jsx'
import PhotoGroupPage from './pages/PhotoGroupPage.jsx'
import OfferThread from './pages/OfferThread.jsx'
import Admin from './pages/Admin.jsx'
import { useSession } from './services/useStore.js'

export default function App() {
  const location = useLocation()
  const authed = useSession()
  const onAdmin = location.pathname.startsWith('/admin')

  return (
    <>
      <Banner />
      <div className="nav">
        <Link to="/" className="brand">
          <span className="dot" />
          Moving Sale
        </Link>
        <div className="nav-actions">
          {onAdmin ? (
            <Link to="/" className="btn btn-ghost btn-sm">
              ← View storefront
            </Link>
          ) : (
            <Link to="/admin" className="btn btn-ghost btn-sm">
              {authed ? 'Admin dashboard' : 'Seller login'}
            </Link>
          )}
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/item/:slug" element={<ItemPage />} />
        <Route path="/photo/:groupId" element={<PhotoGroupPage />} />
        <Route path="/offer/:offerId" element={<OfferThread />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Storefront />} />
      </Routes>
    </>
  )
}
