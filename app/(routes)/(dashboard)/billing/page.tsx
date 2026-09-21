import { ClerkLoaded, ClerkLoading, PricingTable } from "@clerk/nextjs"

const BillingPage = () => {
  return (
    <div className="w-full max-w-6xl px-2 sm:px-6 py-4 sm:py-6 mx-auto min-w-0">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Billing & Subscriptions</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground line-clamp-2 md:line-clamp-none">
          Manage your subscription plans, credits, and billing information.
        </p>
      </div>

      <ClerkLoading>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ClerkLoading>

      <ClerkLoaded>
      <PricingTable
        for="user"
        newSubscriptionRedirectUrl="/billing"
      />
      </ClerkLoaded>
    </div>
  )
}

export default BillingPage