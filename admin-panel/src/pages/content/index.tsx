import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, HelpCircle, Briefcase } from 'lucide-react'

// Sub-components
import { StaticContentTab } from './static-content-tab'
import { FaqTab } from './faq-tab'
import { JobsTab } from './jobs-tab'

export default function ContentManagementPage() {
  const { t } = useTranslation()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Content Management</h2>
      </div>

      <Tabs defaultValue="static" className="space-y-4">
        <TabsList>
          <TabsTrigger value="static" className="gap-2">
            <FileText className="h-4 w-4" />
            Static Pages
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            FAQs
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Job Vacancies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="static" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Static Pages</CardTitle>
              <CardDescription>
                Manage Terms & Conditions, Privacy Policy, and other static content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaticContentTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Manage the FAQs displayed in the help center.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FaqTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Vacancies</CardTitle>
              <CardDescription>
                Manage open positions displayed on the careers page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JobsTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
