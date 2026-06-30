import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      fallbackRedirectUrl="/chat"
      appearance={{
        elements: {
          formButtonPrimary: "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-primary-foreground",
          card: "shadow-none border border-border bg-card",
          headerTitle: "text-foreground font-semibold",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton: "border-border text-foreground hover:bg-muted",
          dividerLine: "bg-border",
          dividerText: "text-muted-foreground",
          formFieldLabel: "text-foreground font-medium",
          formFieldInput: "bg-background border-input text-foreground focus:ring-2 focus:ring-primary focus:border-primary",
          footerActionLink: "text-primary hover:text-primary/90",
        },
      }}
    />
  );
}
