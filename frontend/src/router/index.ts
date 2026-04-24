import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgotPassword from '../views/ForgotPassword.vue'
import ResetPassword from '../views/ResetPassword.vue'
import Dashboard from '../views/Dashboard.vue'
import Settings from '../views/Settings.vue'
import AgreementsLayout from '../views/AgreementsLayout.vue'
import Agreements from '../views/Agreements.vue'
import AgreementHistory from '../views/AgreementHistory.vue'
import Onboarding from '../views/Onboarding.vue'
import AgreementSigning from '../views/AgreementSigning.vue'
import TenantChangeAddendumSigning from '../views/TenantChangeAddendumSigning.vue'
import HelpCentre from '../views/HelpCentre.vue'
import HelpCategory from '../views/HelpCategory.vue'
import HelpArticleView from '../views/HelpArticleView.vue'
import HelpFaq from '../views/HelpFaq.vue'
import HelpSearchResults from '../views/HelpSearchResults.vue'
import LandlordVerification from '../views/LandlordVerification.vue'
import Properties from '../views/Properties.vue'
import TenantOfferPaymentConfirmed from '../views/TenantOfferPaymentConfirmed.vue'
import TenancyPaymentConfirmed from '../views/TenancyPaymentConfirmed.vue'
import ConfirmRentDueDateChange from '../views/ConfirmRentDueDateChange.vue'
import ConfirmTenantChangeFee from '../views/ConfirmTenantChangeFee.vue'
import SelectMoveInTime from '../views/public/SelectMoveInTime.vue'
import ConfirmMoveInTime from '../views/public/ConfirmMoveInTime.vue'
import Verify from '../views/Verify.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    // Auth routes
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: { requiresGuest: true }
    },
    {
      path: '/register',
      name: 'Register',
      component: Register,
      meta: { requiresGuest: true }
    },
    {
      path: '/forgot-password',
      name: 'ForgotPassword',
      component: ForgotPassword,
      meta: { requiresGuest: true }
    },
    {
      path: '/reset-password',
      name: 'ResetPassword',
      component: ResetPassword
    },
    // Onboarding
    {
      path: '/onboarding',
      name: 'Onboarding',
      component: Onboarding,
      meta: { requiresAuth: true, skipOnboardingCheck: true }
    },
    // Core landlord routes
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/offers',
      name: 'Offers',
      component: () => import('../views/TenantOffersV2.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/offers/:id',
      name: 'OfferDetail',
      component: () => import('../views/TenantOfferDetail.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/referencing',
      name: 'Referencing',
      component: () => import('../views/ReferencesV2.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/tenancies',
      name: 'Tenancies',
      component: () => import('../views/Tenancies.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/landlords',
      name: 'Landlords',
      component: () => import('../views/Landlords.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/landlords/:id',
      name: 'LandlordDetail',
      component: () => import('../views/LandlordDetail.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/landlord-decision/:token',
      name: 'LandlordDecision',
      component: () => import('../views/LandlordDecision.vue')
    },
    {
      path: '/properties',
      name: 'Properties',
      component: Properties,
      meta: { requiresAuth: true }
    },
    {
      path: '/properties/:id',
      name: 'PropertyDetail',
      component: () => import('../views/PropertyDetail.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/agreements',
      component: AgreementsLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/agreements/history'
        },
        {
          path: 'generate',
          name: 'GenerateAgreement',
          component: Agreements
        },
        {
          path: 'history',
          name: 'AgreementHistory',
          component: AgreementHistory
        },
        {
          path: ':id/preview',
          name: 'AgreementPreview',
          component: () => import('../views/AgreementPreview.vue')
        }
      ]
    },
    {
      path: '/notifications',
      name: 'Notifications',
      component: () => import('../views/Notifications.vue'),
      meta: { requiresAuth: true }
    },
    // Settings
    {
      path: '/settings',
      component: Settings,
      meta: { requiresAuth: true },
      redirect: '/settings/profile',
      children: [
        {
          path: 'profile',
          name: 'SettingsProfile',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'companies',
          name: 'SettingsCompanies',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'tds',
          name: 'SettingsTDS',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'reposit',
          name: 'SettingsReposit',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'mydeposits',
          name: 'SettingsMyDeposits',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'jmi',
          name: 'SettingsJMI',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'billing',
          name: 'SettingsBilling',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'audit-logs',
          name: 'SettingsAuditLogs',
          component: Settings,
          meta: { requiresAuth: true }
        }
      ]
    },
    // Help Centre
    {
      path: '/help-centre',
      name: 'HelpCentre',
      component: HelpCentre,
      meta: { requiresAuth: true }
    },
    {
      path: '/help-centre/category/:slug',
      name: 'HelpCategory',
      component: HelpCategory,
      meta: { requiresAuth: true }
    },
    {
      path: '/help-centre/article/:slug',
      name: 'HelpArticle',
      component: HelpArticleView,
      meta: { requiresAuth: true }
    },
    {
      path: '/help-centre/faq',
      name: 'HelpFaq',
      component: HelpFaq,
      meta: { requiresAuth: true }
    },
    {
      path: '/help-centre/search',
      name: 'HelpSearch',
      component: HelpSearchResults,
      meta: { requiresAuth: true }
    },
    // Public routes (token-based, no auth required)
    {
      path: '/make-offer/:token',
      name: 'MakeOffer',
      component: () => import('../views/public/MakeOffer.vue')
    },
    {
      path: '/tenant-offer',
      name: 'TenantOffer',
      component: () => import('../views/TenantOfferDetail.vue')
    },
    {
      path: '/tenant-offer/payment-confirmed',
      name: 'TenantOfferPaymentConfirmed',
      component: TenantOfferPaymentConfirmed
    },
    {
      path: '/submit-reference-v2/:token',
      name: 'SubmitReferenceV2',
      component: () => import('../views/SubmitReferenceV2.vue')
    },
    {
      path: '/v2/employer-reference/:token',
      name: 'EmployerReferenceV2',
      component: () => import('../views/RefereeFormV2.vue'),
      meta: { type: 'employer' }
    },
    {
      path: '/v2/landlord-reference/:token',
      name: 'LandlordReferenceV2',
      component: () => import('../views/RefereeFormV2.vue'),
      meta: { type: 'landlord' }
    },
    {
      path: '/v2/accountant-reference/:token',
      name: 'AccountantReferenceV2',
      component: () => import('../views/RefereeFormV2.vue'),
      meta: { type: 'accountant' }
    },
    {
      path: '/guarantor-reference-v2/:token',
      name: 'GuarantorReferenceV2',
      component: () => import('../views/GuarantorReferenceV2.vue')
    },
    {
      path: '/tenant-add-guarantor/:token',
      name: 'TenantAddGuarantor',
      component: () => import('../views/TenantAddGuarantor.vue')
    },
    {
      path: '/mobile-capture/:captureToken',
      name: 'MobileCapture',
      component: () => import('../views/MobileCapture.vue')
    },
    {
      path: '/upload/:token',
      name: 'FileUpload',
      component: () => import('../views/public/FileUploadPage.vue')
    },
    {
      path: '/verify/:referenceId',
      name: 'Verify',
      component: Verify,
      meta: { public: true }
    },
    {
      path: '/sign/:token',
      name: 'AgreementSigning',
      component: AgreementSigning,
      meta: { public: true }
    },
    {
      path: '/sign-tenant-change/:token',
      name: 'TenantChangeAddendumSigning',
      component: TenantChangeAddendumSigning,
      meta: { public: true }
    },
    {
      path: '/tenancy/payment-confirmed/:id',
      name: 'TenancyPaymentConfirmed',
      component: TenancyPaymentConfirmed
    },
    {
      path: '/tenancy/select-move-in-time/:id',
      name: 'SelectMoveInTime',
      component: SelectMoveInTime
    },
    {
      path: '/tenancy/confirm-move-in-time/:id',
      name: 'ConfirmMoveInTime',
      component: ConfirmMoveInTime
    },
    {
      path: '/confirm-rent-change/:token',
      name: 'ConfirmRentDueDateChange',
      component: ConfirmRentDueDateChange
    },
    {
      path: '/confirm-payment/:token',
      name: 'ConfirmTenantChangeFee',
      component: ConfirmTenantChangeFee
    },
    {
      path: '/landlord-verification/:id/:token',
      name: 'LandlordVerification',
      component: LandlordVerification
    },
    // Public issue response routes (no auth)
    {
      path: '/issue-upload/:token',
      name: 'IssueUpload',
      component: () => import('../views/public/IssueUpload.vue')
    },
    {
      path: '/issue-response/:token',
      name: 'IssueResponse',
      component: () => import('../views/public/IssueResponse.vue')
    }
  ]
})

// Navigation guards
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Ensure auth is initialized
  if (!authStore.session && !authStore.user) {
    await authStore.initialize()
  } else if (authStore.user && !authStore.company) {
    await authStore.fetchUser()
  }

  const isAuthenticated = !!authStore.user

  // Authentication checks
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
    return
  }

  if (to.meta.requiresGuest && isAuthenticated) {
    next('/dashboard')
    return
  }

  // Onboarding check
  const publicPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/onboarding'
  ]
  const isPublicPath = publicPaths.some(path => to.path.startsWith(path))
  const isPublicRoute = to.path.startsWith('/submit-reference') ||
                        to.path.startsWith('/make-offer') ||
                        to.path.startsWith('/guarantor-reference') ||
                        to.path.startsWith('/tenant-add-guarantor') ||
                        to.path.startsWith('/mobile-capture') ||
                        to.path.startsWith('/upload/') ||
                        to.path.startsWith('/verify/') ||
                        to.path.startsWith('/v2/employer-reference') ||
                        to.path.startsWith('/v2/landlord-reference') ||
                        to.path.startsWith('/v2/accountant-reference') ||
                        to.path.startsWith('/issue-upload/') ||
                        to.path.startsWith('/issue-response/') ||
                        to.path.startsWith('/sign/') ||
                        to.path.startsWith('/sign-tenant-change/') ||
                        to.path.startsWith('/tenancy/') ||
                        to.path.startsWith('/confirm-rent-change/') ||
                        to.path.startsWith('/confirm-payment/') ||
                        to.path.startsWith('/landlord-verification/') ||
                        to.path.startsWith('/tenant-offer')
  const skipOnboardingCheck = to.meta.skipOnboardingCheck === true

  if (
    isAuthenticated &&
    !authStore.onboardingCompleted &&
    !isPublicPath &&
    !isPublicRoute &&
    !skipOnboardingCheck
  ) {
    next('/onboarding')
    return
  }

  next()
})

// Stale SPA chunk recovery
const RELOAD_FLAG = 'pg_chunk_reload_attempted'
const isChunkLoadError = (err: any): boolean => {
  if (!err) return false
  const msg = (err && (err.message || String(err))) || ''
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    err?.name === 'ChunkLoadError'
  )
}

const handleChunkError = (err: any) => {
  if (!isChunkLoadError(err)) return
  try {
    const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG)
    if (alreadyReloaded) {
      console.error('[Router] Chunk load error after reload — showing update banner:', err)
      showUpdateBanner()
      return
    }
    sessionStorage.setItem(RELOAD_FLAG, '1')
    console.warn('[Router] Stale chunk detected — forcing one hard reload to pick up new build')
    window.location.reload()
  } catch (e) {
    console.error('[Router] Failed to recover from chunk error:', e)
  }
}

function showUpdateBanner() {
  if (document.getElementById('pg-update-banner')) return
  const banner = document.createElement('div')
  banner.id = 'pg-update-banner'
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f97316;color:white;padding:12px 16px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;display:flex;align-items:center;justify-content:center;gap:12px;'
  banner.innerHTML = `
    <span>A new version of PropertyGoose is available.</span>
    <button onclick="sessionStorage.removeItem('pg_chunk_reload_attempted');window.location.reload()" style="padding:6px 16px;background:white;color:#f97316;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;">
      Update Now
    </button>
  `
  document.body.prepend(banner)
}

router.afterEach(() => {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {}
})

router.onError(handleChunkError)

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    handleChunkError(event.reason)
  }
})

export default router
