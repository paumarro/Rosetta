import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { isAuthenticated, loading } = useAuth();

  const handleMicrosoftLogin = () => {
    // Relative path - nginx routes /auth/* to auth-service
    window.location.href = '/auth/login';
  };

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome to Rosetta</CardTitle>
          <CardDescription>
            {isAuthenticated ? (
              <>You are logged in</>
            ) : (
              <>Login with your Microsoft account</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="flex flex-col gap-4">
              {isAuthenticated ? (
                <Link to={'/'}>
                  <Button className="w-full">Continue</Button>
                </Link>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleMicrosoftLogin}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="currentColor"
                    className="mr-2"
                  >
                    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                  </svg>
                  Login with SSO
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{' '}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  );
}
