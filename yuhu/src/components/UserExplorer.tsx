import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import UserExplorerPanel from './UserExplorerPanel';

const UserExplorerTabs: React.FC = () => {
  const [tab, setTab] = useState<'add' | 'pending'>('add');
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Friends</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={v => setTab(v as 'add' | 'pending')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="add" className="flex items-center gap-2">Add Friends</TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-2">Pending</TabsTrigger>
          </TabsList>
          <TabsContent value="add">
            <UserExplorerPanel panel="add" />
          </TabsContent>
          <TabsContent value="pending">
            <UserExplorerPanel panel="pending" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default UserExplorerTabs;
