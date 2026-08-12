/**
 * Route-classification metadata keys shared between `access-management`'s global admin guards
 * (`AccessTokenGuard`, `AdminAuthorizationGuard`) and `installations`' machine-auth decorators/guard
 * (`InstallationAuthGuard`). Neither bounded context may import from the other (see
 * `access-management-cannot-import-other-bounded-contexts` in .dependency-cruiser.cjs) - these are
 * bare, framework-free string constants living in shared-kernel instead, the one place both sides may
 * depend on, so admin auth can recognize "this route belongs to the installation identity plane, skip
 * me" without either bounded context knowing anything else about the other. See
 * docs/architecture/installation-enrollment.md#guards.
 */
export const IS_INSTALLATION_ENROLLMENT_KEY = "isInstallationEnrollment";
export const IS_INSTALLATION_AUTHENTICATED_KEY = "isInstallationAuthenticated";
