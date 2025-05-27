import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OwnPaths from '@/components/creator-studio/own-paths';
import PathContributions from '@/components/creator-studio/path-contributions';
export default function PathDesigner() {
  return (
    <DashboardLayout>
      <Tabs defaultValue="account" className="">
        <TabsList>
          <TabsTrigger value="account">My paths</TabsTrigger>
          <TabsTrigger value="password">Contributions</TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          <OwnPaths />
        </TabsContent>
        <TabsContent value="password">
          <PathContributions />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
