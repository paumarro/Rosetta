import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchForm } from '@/components/search-form';
import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export function CountdownTimer({
  onTimerComplete,
}: {
  onTimerComplete: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimerComplete();
      return;
    }
    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [timeLeft, onTimerComplete]);

  return <span className="font-bold">{timeLeft}</span>;
}

export default function WelcomeForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [skills, setSkills] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleTimerComplete = () => {
    setIsTimerActive(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const formData = {
      skills: skills,
    };

    try {
      //Placeholder for API call
      console.log('Form submitted:', formData);
      await Promise.resolve(); // Simulate API call
      //Redirect to home page
      return void navigate('/');
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  return (
    <>
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome to Rosseta</CardTitle>
            <CardDescription>
              You have <CountdownTimer onTimerComplete={handleTimerComplete} />{' '}
              seconds to add your skills
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <div className="grid gap-6">
                  <div className="grid gap-3">
                    <SearchForm className="w-full" />
                  </div>
                </div>
              </div>
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-card text-muted-foreground relative z-10 px-2">
                  Your skills
                </span>
              </div>

              {/* Selected skills */}
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="cursor-pointer">
                    JavaScript
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer">
                    React
                  </Badge>
                  <Badge variant="outline" className="cursor-pointer">
                    TypeScript
                  </Badge>
                </div>
              </div>

              <div className="grid gap-6">
                <form
                  onSubmit={(e) => {
                    void handleSubmit(e);
                  }}
                >
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isTimerActive}
                  >
                    Continue
                  </Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
          By clicking continue, you agree to our{' '}
          <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
        </div>
      </div>
    </>
  );
}
