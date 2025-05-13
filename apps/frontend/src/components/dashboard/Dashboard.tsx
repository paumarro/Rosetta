import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Welcome to Rosseta
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
          Focus on what&apos;s important. Learn faster with content created by
          the community for everyone&apos;s success.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/hub/learning-path">
            <Button>Explore Learning Paths</Button>
          </Link>
          <Link to="/creator/path-design">
            <Button variant={'secondary'}>Create Content</Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
