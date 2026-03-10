import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function Dashboard() {
  const { data: healthCheck, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(res => res.data),
  })

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to SmartSeen
          </h2>
          <p className="text-gray-600 mb-6">
            Your comprehensive accounting, HR & employee recognition platform
          </p>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="text-lg font-medium mb-2">Backend Status</h3>
            {isLoading ? (
              <p className="text-gray-500">Checking connection...</p>
            ) : healthCheck ? (
              <p className="text-green-600">✅ Connected to backend</p>
            ) : (
              <p className="text-red-600">❌ Backend connection failed</p>
            )}
          </div>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Accounting
              </h3>
              <p className="text-gray-600">
                Manage invoices, expenses, and financial reports
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                HR Management
              </h3>
              <p className="text-gray-600">
                Employee records, payroll, and attendance tracking
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Recognition
              </h3>
              <p className="text-gray-600">
                Employee recognition and performance management
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}