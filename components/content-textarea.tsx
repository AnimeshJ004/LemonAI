import * as React from "react"
import { EmojiPicker } from "@ferrucc-io/emoji-picker"
import { X, ImagePlus, SmileIcon, Eye, ZoomIn, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Spinner } from "./ui/spinner"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
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
  const [previewImage, setPreviewImage] = React.useState<ImageObject | null>(null)

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      const nextHeight = Math.max(120, Math.min(textareaRef.current.scrollHeight, 380))
      textareaRef.current.style.height = `${nextHeight}px`
    }
  }, [value])

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
    <div className={cn("flex flex-col w-full gap-3", className)}>
      {/* Editable area */}
      <div className="w-full">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full bg-transparent ring-0! border-none! shadow-none! resize-none! p-0 focus-visible:ring-0 focus-visible:outline-none focus:outline-none",
            "placeholder:text-muted-foreground/80 leading-relaxed text-[15px] min-h-[120px] max-h-[380px] overflow-y-auto",
            disabled && "opacity-50 cursor-not-allowed",
            contentClass
          )}
        />
      </div>

      {/* Image Upload & Media Gallery Section */}
      <div className="w-full space-y-2 pt-3 border-t border-border/50">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Add Image Button */}
          <div
            onClick={() => !isUploading && !disabled && fileInputRef.current?.click()}
            className={cn(
              `shrink-0 h-16 w-24 border-2 border-dashed border-muted-foreground/30
               rounded-lg flex flex-col items-center 
              justify-center cursor-pointer hover:border-primary hover:bg-muted/50 
              transition-all shadow-xs bg-muted/10`,
              (isUploading || disabled) && "opacity-50 cursor-not-allowed",
              disabled && "grayscale"
            )}
          >
            {isUploading ? (
              <Spinner className="h-4 w-4 text-primary" />
            ) : (
              <ImagePlus className="h-4 w-4 text-muted-foreground mb-1" />
            )}
            <span className="text-[11px] font-medium text-muted-foreground">
              {isUploading ? "Uploading..." : "Add Image"}
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

          {/* Uploaded / AI Generated Images Preview List */}
          {images.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {images.map((image, index) => (
                <div
                  key={image.key || image.url || index}
                  className="relative size-16 rounded-lg overflow-hidden border-2 border-primary/20 hover:border-primary shadow-xs group cursor-pointer bg-muted/40 transition-all shrink-0"
                  onClick={() => setPreviewImage(image)}
                >
                  <img
                    src={image.url}
                    alt={`Media ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  {/* Hover Overlay with View Icon */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ZoomIn className="size-4 text-white drop-shadow" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveImage(index)
                    }}
                    className="absolute top-1 right-1 z-10 bg-black/80 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors shadow-xs"
                    title="Remove media"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Media Preview Lightbox Dialog */}
        <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border shadow-2xl">
            <DialogHeader className="p-4 pb-2 border-b flex flex-row items-center justify-between">
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="size-4 text-primary" /> Full Media Preview
              </DialogTitle>
              {previewImage && (
                <a
                  href={previewImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border rounded-md px-2 py-1 bg-muted/40 transition-colors mr-6"
                >
                  <ExternalLink className="size-3" /> Open Fullscreen
                </a>
              )}
            </DialogHeader>
            {previewImage && (
              <div className="p-4 flex flex-col items-center justify-center bg-muted/20">
                <div className="relative max-h-[70vh] max-w-full rounded-lg overflow-hidden border shadow-md bg-black/5 flex items-center justify-center">
                  <img
                    src={previewImage.url}
                    alt="Media preview"
                    className="max-h-[65vh] w-auto object-contain rounded-md"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 text-center break-all">
                  {previewImage.key || previewImage.url}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

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