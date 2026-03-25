"use client"

import LoadingDots from "@/components/icons/loading-dots"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus } from "lucide-react"
import FeesTable from "@/components/fees-table"
import FeeModal from "@/components/modal/fee-modal"
import { getAccount } from "@/lib/fetchers/client"
import Link from "next/link"

export default function FeesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [isAdmin, setIsAdmin] = useState(false)
  const [fees, setFees] = useState<any[]>([])
  const [feesLoading, setFeesLoading] = useState(true)
  const [feeModalOpen, setFeeModalOpen] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (error || profile?.role !== "admin") {
        router.replace("/")
        return
      }

      setIsAdmin(true)
    }

    checkAuth()
  }, [])

  useEffect(() => {
    if (!isAdmin) return

    const fetchFees = async () => {
      setFeesLoading(true)
      try {
        const account = await getAccount()

        const { data: feesData, error } = await supabase
          .from("fees")
          .select("*")
          .eq("account_id", account?.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: false })

        if (error) throw error

        setFees(feesData || [])
      } catch (error) {
        console.error("Error fetching fees:", error)
        toast.error("Failed to load fees")
      } finally {
        setFeesLoading(false)
      }
    }

    fetchFees()
  }, [isAdmin, feeModalOpen])

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingDots color="#808080" />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6 py-8">
      <div>
        <Link
          href="/settings/account"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workspace settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-cal text-3xl font-bold dark:text-white">
              Fees
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Create and manage fees for your teams and athletes
            </p>
          </div>
          <Button onClick={() => setFeeModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Fee
          </Button>
        </div>
      </div>

      {feesLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingDots color="#808080" />
        </div>
      ) : (
        <FeesTable fees={fees} />
      )}

      <FeeModal open={feeModalOpen} onOpenChange={setFeeModalOpen} />
    </div>
  )
}
