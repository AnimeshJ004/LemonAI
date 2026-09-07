import { SignUp } from "@clerk/nextjs"

const SignUpPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignUp 
        path="/sign-up" 
        signInUrl="/sign-in" 
        forceRedirectUrl="/onboarding" 
        fallbackRedirectUrl="/onboarding"
      />
    </div>
  )
}

export default SignUpPage