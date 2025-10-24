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
import LandlordReference from '../views/LandlordReference.vue'
import AgentReference from '../views/AgentReference.vue'
import EmployerReference from '../views/EmployerReference.vue'
import AccountantReference from '../views/AccountantReference.vue'
import Settings from '../views/Settings.vue'
import StaffLogin from '../views/StaffLogin.vue'
import StaffDashboard from '../views/StaffDashboard.vue'
import StaffReferenceDetail from '../views/StaffReferenceDetail.vue'
import StaffVerification from '../views/StaffVerification.vue'

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
      path: '/staff/references/:id',
      name: 'StaffReferenceDetail',
      component: StaffReferenceDetail,
      meta: { requiresAuth: true }
    },
    {
      path: '/staff/verification/:id',
      name: 'StaffVerification',
      component: StaffVerification,
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

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
