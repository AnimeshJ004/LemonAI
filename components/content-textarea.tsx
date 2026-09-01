"use client"

import * as React from "react"
import { EmojiPicker } from "@ferrucc-io/emoji-picker"
import { X, Wand2Icon, ImagePlus, SmileIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Separator } from "./ui/separator"
import { Spinner } from "./ui/spinner"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Textarea } from "./ui/textarea"
import { ImageObject } from "@/types/post.type"


interface ContentTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  contentClass?: string
  minHeight?: number
  showAIAssistant?: boolean
  onAIAssistantClick?: () => void
  showHashtag?: boolean
  className?: string
  images?: ImageObject[]
  onImagesChange?: (images: ImageObject[]) => void
  renderToolbarRight?: React.ReactNode
  renderContent?: React.ReactNode
  disabled?: boolean
}

const ContentTextarea = ({
  value,
  onChange,
  placeholder = "What's on your mind?",
  contentClass,
  minHeight = 280,
  showAIAssistant = false,
  onAIAssistantClick,
  className,
  images = [],
  onImagesChange,
  renderToolbarRight,
  renderContent,
  disabled = false
}: ContentTextareaProps) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [emojiOpen, setEmojiOpen] = React.useState(false)

  const insertEmoji = (emoji: string) => {
    if (disabled) return
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(`${value}${emoji}`)
      setEmojiOpen(false)
      return
    }
    const start = textarea.selectionStart ?? value.length
    const end = textarea.selectionEnd ?? value.length
    const nextValue = `${value.slice(0, start)}${emoji}${value.slice(end)}`

    onChange(nextValue)
    setEmojiOpen(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newImages = [...images]

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        })
        if (!response.ok) throw new Error("Upload failed")
        const result = await response.json()
        if (result.image) {
          newImages.push({
            url: result.image.url,
            key: result.image.key
          })
        }
      }
      onImagesChange?.(newImages)
    } catch (error) {
      console.error("Upload error:", error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    onImagesChange?.(images.filter((_, i) => i !== index))
  }

  return (
    <div className={cn("flex flex-col h-full justify-between gap-3", className)}>
      {/* Editable area */}
      <div className="flex-1 w-full min-h-[160px] overflow-y-auto">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full bg-transparent ring-0! border-none! shadow-none! resize-none! p-0 focus-visible:ring-0 focus-visible:outline-none focus:outline-none",
            "placeholder:text-muted-foreground/80 leading-relaxed text-[15px]",
            disabled && "opacity-50 cursor-not-allowed",
            contentClass
          )}
          style={{ minHeight: `${Math.min(minHeight - 80, 180)}px` }}
        />
      </div>

      <div className="shrink-0 space-y-3 pt-3 border-t border-border/40">
        {/* Image Upload Section */}
        <div className="flex items-center gap-3">
          {/* Add Image Button */}
          <div
            onClick={() => !isUploading && !disabled && fileInputRef.current?.click()}
            className={cn(
              `shrink-0 h-16 w-24 border-2 border-dashed border-muted-foreground/25
               rounded-lg flex flex-col items-center 
              justify-center cursor-pointer hover:border-primary/50
               hover:bg-muted/40 
              transition-colors shadow-sm`,
              (isUploading || disabled) && "opacity-50 cursor-not-allowed",
              disabled && "grayscale"
            )}
          >
            {isUploading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <ImagePlus className="h-4 w-4 text-muted-foreground mb-1" />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {isUploading ? "Uploading..." : "Select File"}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Uploaded Images - Scrollable container */}
          {images.length > 0 && (
            <div className="flex gap-2.5 w-full max-w-[460px] overflow-x-auto pb-1">
              {images.map((image, index) => (
                <div
                  key={image.key || index}
                  className="shrink-0 relative size-16 rounded-lg overflow-hidden border shadow-sm"
                >
                  <img
                    src={image.url}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button size="icon" className="cursor-pointer size-8" variant="ghost" disabled={disabled}>
                  <SmileIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[300px] p-0!">
                <EmojiPicker
                  onEmojiSelect={insertEmoji}
                  className="w-full! rounded-lg bg-popover ring-0!"
                  emojisPerRow={6}
                  emojiSize={36}
                >
                  <EmojiPicker.Header className="border-b border-border pb-2">
                    <EmojiPicker.Input
                      placeholder="Search emoji"
                      autoFocus
                      className="h-8 border border-border! bg-background ring-0!"
                    />
                  </EmojiPicker.Header>
                  <EmojiPicker.Group>
                    <EmojiPicker.List hideStickyHeader containerHeight={320} />
                  </EmojiPicker.Group>
                </EmojiPicker>
              </PopoverContent>
            </Popover>
          </div>
          {renderToolbarRight && (
            <div className="flex items-center gap-2">{renderToolbarRight}</div>
          )}
        </div>

        {renderContent && <>{renderContent}</>}
      </div>
    </div>
  )
}
export default ContentTextarea