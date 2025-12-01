import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import ForgotPassword from '../views/ForgotPassword.vue'
import ResetPassword from '../views/ResetPassword.vue'
import AcceptInvite from '../views/AcceptInvite.vue'
import Dashboard from '../views/Dashboard.vue'
import References from '../views/References.vue'
import ReferenceDetail from '../views/ReferenceDetail.vue'
import SubmitReference from '../views/SubmitReference.vue'
import TenantApplication from '../views/TenantApplication.vue'
import CreateTenantApplication from '../views/CreateTenantApplication.vue'
import GuarantorReference from '../views/GuarantorReference.vue'
import LandlordReference from '../views/LandlordReference.vue'
import AgentReference from '../views/AgentReference.vue'
import EmployerReference from '../views/EmployerReference.vue'
import AccountantReference from '../views/AccountantReference.vue'
import Settings from '../views/Settings.vue'
import Agreements from '../views/Agreements.vue'
import AgreementsLayout from '../views/AgreementsLayout.vue'
import AgreementHistory from '../views/AgreementHistory.vue'
import Onboarding from '../views/Onboarding.vue'
import StaffLogin from '../views/StaffLogin.vue'
import StaffDashboard from '../views/StaffDashboard.vue'
import StaffChaseList from '../views/StaffChaseList.vue'
import StaffReferenceDetail from '../views/StaffReferenceDetail.vue'
import StaffVerification from '../views/StaffVerification.vue'
import StaffVerificationNew from '../views/StaffVerificationNew.vue'
import StaffReferenceView from '../views/StaffReferenceView.vue'
import StaffWorkQueue from '../views/StaffWorkQueue.vue'
import StaffChasePanel from '../views/StaffChasePanel.vue'
import Landlords from '../views/Landlords.vue'
import LandlordDetail from '../views/LandlordDetail.vue'
import LandlordVerification from '../views/LandlordVerification.vue'
import TenantOffer from '../views/TenantOffer.vue'
import TenantOffers from '../views/TenantOffers.vue'
import TenantOfferDetail from '../views/TenantOfferDetail.vue'
import TenantOfferPaymentConfirmed from '../views/TenantOfferPaymentConfirmed.vue'

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
      path: '/references/:id',
      name: 'ReferenceDetail',
      component: ReferenceDetail,
      meta: { requiresAuth: true }
    },
    {
      path: '/submit-reference/:token',
      name: 'SubmitReference',
      component: SubmitReference
    },
    {
      path: '/tenant-application/:token',
      name: 'TenantApplication',
      component: TenantApplication
    },
    {
      path: '/tenant-offer',
      name: 'TenantOffer',
      component: TenantOffer
    },
    {
      path: '/tenant-offer/payment-confirmed',
      name: 'TenantOfferPaymentConfirmed',
      component: TenantOfferPaymentConfirmed
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
      path: '/tenant-applications/create',
      name: 'CreateTenantApplication',
      component: CreateTenantApplication,
      meta: { requiresAuth: true }
    },
    {
      path: '/guarantor-reference/:token',
      name: 'GuarantorReference',
      component: GuarantorReference
    },
    {
      path: '/landlord-reference/:referenceId',
      name: 'LandlordReference',
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
      path: '/accountant-reference/:token',
      name: 'AccountantReference',
      component: AccountantReference
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
    {
      path: '/staff',
      redirect: () => {
        const authStore = useAuthStore()
        return authStore.user ? '/staff/dashboard' : '/staff/login'
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
      name: 'StaffDashboard',
      component: StaffDashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/chase-list',
      name: 'StaffChaseList',
      component: StaffChaseList,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/work-queue',
      name: 'StaffWorkQueue',
      component: StaffWorkQueue,
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
    }
  ]
})

// Navigation guards
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Ensure auth is initialized by checking the session
  if (!authStore.session && !authStore.user) {
    await authStore.initialize()
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
    to.path.startsWith('/tenant-application') ||
                                 to.path.startsWith('/tenant-offer') ||
                                 to.path.startsWith('/guarantor-reference') ||
                                 to.path.startsWith('/landlord-reference') ||
                                 to.path.startsWith('/agent-reference') ||
                                 to.path.startsWith('/employer-reference') ||
                                 to.path.startsWith('/accountant-reference')
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

  next()
})

export default router
