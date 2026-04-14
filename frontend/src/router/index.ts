import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgotPassword from '../views/ForgotPassword.vue'
import ResetPassword from '../views/ResetPassword.vue'
import AcceptInvite from '../views/AcceptInvite.vue'
import Dashboard from '../views/Dashboard.vue'
import References from '../views/References.vue'
import SubmitReference from '../views/SubmitReference.vue'
import GuarantorReference from '../views/GuarantorReference.vue'
import TenantAddGuarantor from '../views/TenantAddGuarantor.vue'
import LandlordReference from '../views/LandlordReference.vue'
import AgentReference from '../views/AgentReference.vue'
import EmployerReference from '../views/EmployerReference.vue'
import AccountantReference from '../views/AccountantReference.vue'
import Settings from '../views/Settings.vue'
import Agreements from '../views/Agreements.vue'
import AgreementsLayout from '../views/AgreementsLayout.vue'
import AgreementHistory from '../views/AgreementHistory.vue'
import Onboarding from '../views/Onboarding.vue'
import BranchSelector from '../views/BranchSelector.vue'
import StaffLogin from '../views/StaffLogin.vue'
import StaffReferenceDetail from '../views/StaffReferenceDetail.vue'
import StaffVerification from '../views/StaffVerification.vue'
import StaffVerificationNew from '../views/StaffVerificationNew.vue'
import StaffReferenceView from '../views/StaffReferenceView.vue'
import StaffVapiTest from '../views/StaffVapiTest.vue'
import StaffPortal from '../views/StaffPortal.vue'
import StaffChasePanel from '../views/StaffChasePanel.vue'
import VerifyCaseView from '../components/staff/verify/VerifyCaseView.vue'
import Landlords from '../views/Landlords.vue'
import LandlordDetail from '../views/LandlordDetail.vue'
import Properties from '../views/Properties.vue'
import LandlordVerification from '../views/LandlordVerification.vue'
import TenantOffer from '../views/TenantOffer.vue'
import TenantOffers from '../views/TenantOffers.vue'
import LandlordDecision from '../views/LandlordDecision.vue'
import TenantOfferDetail from '../views/TenantOfferDetail.vue'
import TenantOfferPaymentConfirmed from '../views/TenantOfferPaymentConfirmed.vue'
import TenancyPaymentConfirmed from '../views/TenancyPaymentConfirmed.vue'
import ConfirmRentDueDateChange from '../views/ConfirmRentDueDateChange.vue'
import ConfirmTenantChangeFee from '../views/ConfirmTenantChangeFee.vue'
import SelectMoveInTime from '../views/public/SelectMoveInTime.vue'
import ConfirmMoveInTime from '../views/public/ConfirmMoveInTime.vue'
import Verify from '../views/Verify.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminStaffManagement from '../views/AdminStaffManagement.vue'
import AdminCustomerManagement from '../views/AdminCustomerManagement.vue'
import AdminReports from '../views/AdminReports.vue'
import AgreementSigning from '../views/AgreementSigning.vue'
import TenantChangeAddendumSigning from '../views/TenantChangeAddendumSigning.vue'
import HelpCentre from '../views/HelpCentre.vue'
import HelpCategory from '../views/HelpCategory.vue'
import HelpArticleView from '../views/HelpArticleView.vue'
import HelpFaq from '../views/HelpFaq.vue'
import HelpSearchResults from '../views/HelpSearchResults.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
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
    {
      path: '/accept-invite/:token',
      name: 'AcceptInvite',
      component: AcceptInvite,
      meta: { requiresGuest: true }
    },
    {
      path: '/onboarding',
      name: 'Onboarding',
      component: Onboarding,
      meta: { requiresAuth: true, skipOnboardingCheck: true }
    },
    {
      path: '/select-branch',
      name: 'BranchSelector',
      component: BranchSelector,
      meta: { requiresAuth: true, skipOnboardingCheck: true }
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/references',
      name: 'References',
      component: References,
      meta: { requiresAuth: true }
    },
    {
      path: '/tenancies',
      name: 'Tenancies',
      component: () => import('../views/Tenancies.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/submit-reference/:token',
      name: 'SubmitReference',
      component: SubmitReference
    },
    {
      path: '/submit-reference-v2/:token',
      name: 'SubmitReferenceV2',
      component: () => import('../views/SubmitReferenceV2.vue')
    },
    {
      path: '/tenant-offer',
      name: 'TenantOffer',
      component: TenantOffer
    },
    {
      path: '/make-offer/:token',
      name: 'MakeOffer',
      component: () => import('../views/public/MakeOffer.vue')
    },
    {
      path: '/tenant-offer/payment-confirmed',
      name: 'TenantOfferPaymentConfirmed',
      component: TenantOfferPaymentConfirmed
    },
    {
      path: '/landlord-decision/:token',
      name: 'LandlordDecision',
      component: LandlordDecision
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
      path: '/tenant-offers',
      name: 'TenantOffers',
      component: TenantOffers,
      meta: { requiresAuth: true }
    },
    {
      path: '/tenant-offers/:id',
      name: 'TenantOfferDetail',
      component: TenantOfferDetail,
      meta: { requiresAuth: true }
    },
    {
      path: '/tenant-offers-v2',
      name: 'TenantOffersV2',
      component: () => import('../views/TenantOffersV2.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/references-v2',
      name: 'ReferencesV2',
      component: () => import('../views/ReferencesV2.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/inventory',
      name: 'InventoryGoose',
      component: () => import('../views/InventoryGooseComingSoon.vue'),
      meta: { requiresAuth: true }
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
      path: '/guarantor-reference/:token',
      name: 'GuarantorReference',
      component: GuarantorReference
    },
    {
      path: '/guarantor-reference-v2/:token',
      name: 'GuarantorReferenceV2',
      component: () => import('../views/GuarantorReferenceV2.vue')
    },
    {
      path: '/tenant-add-guarantor/:token',
      name: 'TenantAddGuarantor',
      component: TenantAddGuarantor
    },
    {
      path: '/landlord-reference/:referenceId',
      name: 'LandlordReference',
      component: LandlordReference
    },
    {
      path: '/submit-landlord-reference/:token',
      name: 'SubmitLandlordReferenceLegacy',
      component: LandlordReference
    },
    {
      path: '/agent-reference/:referenceId',
      name: 'AgentReference',
      component: AgentReference
    },
    {
      path: '/employer-reference/:referenceId',
      name: 'EmployerReference',
      component: EmployerReference
    },
    {
      path: '/submit-employer-reference/:token',
      name: 'SubmitEmployerReference',
      component: EmployerReference
    },
    {
      path: '/accountant-reference/:token',
      name: 'AccountantReference',
      component: AccountantReference
    },
    {
      path: '/submit-accountant-reference/:token',
      name: 'SubmitAccountantReferenceLegacy',
      component: AccountantReference
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
      path: '/agreements',
      component: AgreementsLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/agreements/generate'
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
      path: '/landlords',
      name: 'Landlords',
      component: Landlords,
      meta: { requiresAuth: true }
    },
    {
      path: '/landlords/:id',
      name: 'LandlordDetail',
      component: LandlordDetail,
      meta: { requiresAuth: true }
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
      path: '/notifications',
      name: 'Notifications',
      component: () => import('../views/Notifications.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/landlord-verification/:id/:token',
      name: 'LandlordVerification',
      component: LandlordVerification
    },
    {
      path: '/billing',
      redirect: '/settings/billing',
      meta: { requiresAuth: true }
    },
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
          path: 'company',
          name: 'SettingsCompany',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'branding',
          name: 'SettingsBranding',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'team',
          name: 'SettingsTeam',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'integrations',
          redirect: '/settings/tds',
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
          path: 'review-links',
          name: 'SettingsReviewLinks',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'apex27',
          name: 'SettingsApex27',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'inventorygoose',
          name: 'SettingsInventoryGoose',
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
          path: 'jmi',
          name: 'SettingsJMI',
          component: Settings,
          meta: { requiresAuth: true }
        },
        {
          path: 'property-settings',
          name: 'SettingsPropertySettings',
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
    {
      path: '/rentgoose',
      name: 'RentGoose',
      component: () => import('../views/RentGoose.vue'),
      meta: { requiresAuth: true }
    },
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
    {
      path: '/staff',
      redirect: () => {
        const authStore = useAuthStore()
        return authStore.user ? '/staff/work-queue' : '/staff/login'
      }
    },
    {
      path: '/staff/login',
      name: 'StaffLogin',
      component: StaffLogin,
      meta: { requiresGuest: true }
    },
    {
      path: '/staff/dashboard',
      redirect: '/staff/work-queue'
    },
    {
      path: '/staff/work-queue',
      name: 'StaffWorkQueue',
      component: StaffPortal,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/verify/:id',
      name: 'StaffVerifyCase',
      component: VerifyCaseView,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/work-queue/chase/:id',
      name: 'StaffChasePanel',
      component: StaffChasePanel,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/references/:id',
      name: 'StaffReferenceDetail',
      component: StaffReferenceDetail,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/verification/:id',
      name: 'StaffVerification',
      component: StaffVerificationNew,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/verification-old/:id',
      name: 'StaffVerificationOld',
      component: StaffVerification,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/view/:id',
      name: 'StaffReferenceView',
      component: StaffReferenceView,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/vapi-test',
      name: 'StaffVapiTest',
      component: StaffVapiTest,
      meta: { requiresAuth: true }
    },
    // Staff V2 Routes
    {
      path: '/staff/v2',
      name: 'StaffDashboardV2',
      component: () => import('../views/staff/v2/DashboardV2.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/queue/:type',
      name: 'StaffQueueV2',
      component: () => import('../views/staff/v2/QueueView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/section/:sectionId',
      name: 'StaffSectionReviewV2',
      component: () => import('../views/staff/v2/SectionReview.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/chase',
      name: 'StaffChaseQueueV2',
      component: () => import('../views/staff/v2/ChaseQueue.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/final-review',
      name: 'StaffFinalReviewV2',
      component: () => import('../views/staff/v2/FinalReviewView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/final-review/:referenceId',
      name: 'StaffFinalReviewDetailV2',
      component: () => import('../views/staff/v2/FinalReviewView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/group-assessment',
      name: 'GroupAssessmentV2',
      component: () => import('../views/staff/v2/GroupAssessmentView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/responses',
      name: 'StaffResponsesQueueV2',
      component: () => import('../views/staff/v2/ResponsesQueueV2.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/responses/:sectionId',
      name: 'StaffResponseReviewV2',
      component: () => import('../views/staff/v2/ResponseReviewV2.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/v2/reference/:id',
      name: 'StaffReferenceDetailV2',
      component: () => import('../views/staff/v2/StaffReferenceDetailV2.vue'),
      meta: { requiresAuth: true }
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
    },
    {
      path: '/admin',
      redirect: '/admin/dashboard'
    },
    {
      path: '/admin/dashboard',
      name: 'AdminDashboard',
      component: AdminDashboard,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/staff',
      name: 'AdminStaffManagement',
      component: AdminStaffManagement,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/customers',
      name: 'AdminCustomerManagement',
      component: AdminCustomerManagement,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/create-company',
      name: 'AdminCreateCompany',
      component: () => import('../views/AdminCreateCompany.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/references',
      name: 'AdminReferences',
      component: () => import('../views/AdminReferences.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/reports',
      name: 'AdminReports',
      component: AdminReports,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/integrations',
      name: 'AdminIntegrations',
      component: () => import('../views/AdminIntegrations.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/error-logs',
      name: 'AdminErrorLogs',
      component: () => import('../views/AdminErrorLogs.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    }
  ]
})

// Navigation guards
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Ensure auth is initialized by checking the session
  if (!authStore.session && !authStore.user) {
    await authStore.initialize()
  } else if (authStore.user && !authStore.company && !authStore.isStaff) {
    // User is logged in but auth data hasn't been fetched yet (e.g., after code update)
    await authStore.fetchUser()
  }

  const isAuthenticated = !!authStore.user

  // Authentication checks
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
    return
  }

  if (to.meta.requiresGuest && isAuthenticated) {
    // Redirect to appropriate portal based on user type
    if (authStore.isStaff) {
      next('/staff/work-queue')
    } else {
      next('/dashboard')
    }
    return
  }

  // Onboarding check - redirect to onboarding if incomplete
  // Skip check for: onboarding route, public routes, staff routes, reference submission routes
  const publicPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/accept-invite',
    '/onboarding'
  ]
  const isPublicPath = publicPaths.some(path => to.path.startsWith(path))
  const isStaffPath = to.path.startsWith('/staff')
  const isReferenceSubmission = to.path.startsWith('/submit-reference') ||
                                 to.path.startsWith('/tenant-offer') ||
                                 to.path.startsWith('/make-offer') ||
                                 to.path.startsWith('/guarantor-reference') ||
                                 to.path.startsWith('/guarantor-reference-v2') ||
                                 to.path.startsWith('/tenant-add-guarantor') ||
                                 to.path.startsWith('/landlord-reference') ||
                                 to.path.startsWith('/landlord-decision') ||
                                 to.path.startsWith('/mobile-capture') ||
                                 to.path.startsWith('/upload/') ||
                                 to.path.startsWith('/verify/') ||
                                 to.path.startsWith('/agent-reference') ||
                                 to.path.startsWith('/employer-reference') ||
                                 to.path.startsWith('/submit-employer-reference') ||
                                 to.path.startsWith('/accountant-reference') ||
                                 to.path.startsWith('/v2/employer-reference') ||
                                 to.path.startsWith('/v2/landlord-reference') ||
                                 to.path.startsWith('/v2/accountant-reference') ||
                                 to.path.startsWith('/issue-upload/') ||
                                 to.path.startsWith('/issue-response/') ||
                                 to.path.startsWith('/sign/') ||
                                 to.path.startsWith('/sign-tenant-change/') ||
                                 to.path.startsWith('/tenancy/') ||
                                 to.path.startsWith('/confirm-rent-change/') ||
                                 to.path.startsWith('/confirm-payment/')
  const skipOnboardingCheck = to.meta.skipOnboardingCheck === true

  if (
    isAuthenticated &&
    !authStore.onboardingCompleted &&
    !isPublicPath &&
    !isStaffPath &&
    !isReferenceSubmission &&
    !skipOnboardingCheck
  ) {
    next('/onboarding')
    return
  }

  // Admin access check - redirect to dashboard if user is not an admin
  const isAdminPath = to.path.startsWith('/admin')
  if (isAdminPath && !authStore.isAdmin) {
    next(authStore.isStaff ? '/staff/work-queue' : '/dashboard')
    return
  }

  // Staff portal access check - only staff can access /staff/* routes (except /staff/login)
  const isStaffPortalPath = to.path.startsWith('/staff') && to.path !== '/staff/login'
  if (isStaffPortalPath && !authStore.isStaff) {
    // Non-staff trying to access staff portal
    next(authStore.company ? '/dashboard' : '/login')
    return
  }

  // Agent portal access check - staff members cannot access agent routes
  // Exception: Staff admins CAN access agent routes (for viewing company accounts)
  const agentPaths = ['/dashboard', '/references', '/tenancies', '/agreements', '/landlords', '/properties', '/tenant-offers', '/settings', '/onboarding']
  const isAgentPath = agentPaths.some(path => to.path.startsWith(path))
  if (isAgentPath && authStore.isStaff && isAuthenticated && !authStore.isAdmin) {
    // Staff member (non-admin) trying to access agent portal - redirect to staff work queue
    next('/staff/work-queue')
    return
  }

  // Multi-branch check: If user has multiple branches but none selected, redirect to selector
  const isBranchSelector = to.path === '/select-branch'
  if (isAuthenticated && !authStore.isStaff && !isBranchSelector && !isPublicPath) {
    // If branches are loaded and user has multiple but no active one selected
    if (authStore.hasMultipleBranches && !authStore.activeBranchId) {
      next('/select-branch')
      return
    }
  }

  next()
})

// ----------------------------------------------------------------------------
// Stale SPA chunk recovery
// ----------------------------------------------------------------------------
// When the frontend is redeployed, the file names of lazy-loaded route chunks
// change (Vite content-hashes them). Tabs that were already open still hold a
// reference to the old chunk filenames; the next time the user navigates to a
// lazy route, the import 404s and the page silently fails to render. We catch
// the import error here and reload the page once so the user picks up the new
// asset manifest. The session-storage flag prevents infinite reload loops if
// the failure is genuine (e.g. real network error or a missing asset on the
// new build).
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
      console.error('[Router] Chunk load error after reload — not retrying:', err)
      return
    }
    sessionStorage.setItem(RELOAD_FLAG, '1')
    console.warn('[Router] Stale chunk detected — forcing one hard reload to pick up new build')
    // Hard reload so the new index.html (with fresh asset hashes) loads
    window.location.reload()
  } catch (e) {
    console.error('[Router] Failed to recover from chunk error:', e)
  }
}

// Clear the reload flag on any successful navigation so future stale-chunk
// recoveries can happen again.
router.afterEach(() => {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {}
})

router.onError(handleChunkError)

// Belt-and-braces: also catch unhandled rejections that bubble up from
// async chunk imports outside the router.
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    handleChunkError(event.reason)
  }
})

export default router
