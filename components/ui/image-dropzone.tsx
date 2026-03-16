"use client"

import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import { ImageIcon, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const ACCEPT = "image/jpeg,image/png,image/webp"
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

interface ImageDropzoneProps {
  value: string | null
  onChange: (url: string | null) => void
  onFileSelect: (file: File) => Promise<string>
  onError?: (message: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ImageDropzone({
  value,
  onChange,
  onFileSelect,
  onError,
  placeholder = "Drop image here or click to upload",
  disabled = false,
  className,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      if (file.size > MAX_SIZE) {
        onError?.("Image must be under 5MB")
        return
      }
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (!["jpg", "jpeg", "png", "webp"].includes(ext || "")) {
        onError?.("Please use JPG, PNG, or WebP")
        return
      }

      setIsUploading(true)
      try {
        const url = await onFileSelect(file)
        onChange(url)
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Failed to upload image")
      } finally {
        setIsUploading(false)
      }
    },
    [onFileSelect, onChange, onError]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled || isUploading) return
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [disabled, isUploading, handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    if (disabled || isUploading) return
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ACCEPT
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) handleFile(file)
    }
    input.click()
  }, [disabled, isUploading, handleFile])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
        isDragging && "border-primary bg-primary/5",
        !value && !isDragging && "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50",
        value && "border-transparent",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {value ? (
        <>
          <Avatar className="h-20 w-20">
            <AvatarImage src={value} alt="Preview" />
            <AvatarFallback>
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="mt-2 text-xs text-muted-foreground hover:text-red-600"
            >
              Remove
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 px-4">
          {isUploading ? (
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          )}
          <p className="text-center text-sm text-muted-foreground">
            {isUploading ? "Uploading..." : placeholder}
          </p>
        </div>
      )}
    </div>
  )
}
