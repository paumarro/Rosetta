import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OwnPaths from '@/components/creator-studio/own-paths';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
export default function PathDesigner() {
  return (
    <DashboardLayout>
      <Tabs defaultValue="my-paths" className="w-full">
        <div className="flex justify-between">
          <TabsList>
            <TabsTrigger value="my-paths">My paths</TabsTrigger>
          </TabsList>
          <Link to={'/creator/path-design/create-new'}>
            <Button className="relative overflow-hidden cursor-pointer before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] before:bg-[length:250%_250%,100%_100%] before:bg-no-repeat before:[animation:shine_3000ms_linear_infinite]">
              Create New Path
            </Button>
          </Link>
        </div>
        <TabsContent value="my-paths">
          <OwnPaths />
        </TabsContent>

      </Tabs>
    </DashboardLayout>
  );
}
