import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Mail,
  MessageSquare,
  Share2,
  Twitter,
  Linkedin,
  Facebook,
  Check,
} from "lucide-react";
import type { Decision, AnalysisResult } from "@/features/decisions/types/decision";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: Decision;
  result: AnalysisResult;
}

export function ShareDialog({ open, onOpenChange, decision, result }: ShareDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Get the share URL - uses environment variable if set, otherwise uses current URL
  // This ensures it works correctly in both development and production
  const getShareUrl = () => {
    if (typeof window === 'undefined') return '';
    
    // Check if a base URL is configured in environment variables
    const baseUrl = import.meta.env.VITE_APP_URL;
    
    if (baseUrl) {
      // Use configured base URL + current path
      const path = window.location.pathname;
      return `${baseUrl}${path}`;
    }
    
    // Fallback to current URL (works for both localhost and production)
    return window.location.href;
  };

  const shareUrl = getShareUrl();
  const shareTitle = `Decision Analysis: ${decision.title}`;
  const shareText = `I used KLAROS to analyze "${decision.title}". Recommended: ${result.recommendation.optionLabel} with ${Math.round(result.recommendation.confidence * 100)}% confidence.`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Decision link has been copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        toast({
          title: "Shared successfully",
          description: "Your decision analysis has been shared.",
        });
        onOpenChange(false);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error("Share error:", error);
        }
      }
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(shareTitle);
    const body = encodeURIComponent(`${shareText}\n\nView the full analysis: ${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'width=550,height=420');
  };

  const handleLinkedInShare = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=550,height=420');
  };

  const handleFacebookShare = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=550,height=420');
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Decision Analysis
          </DialogTitle>
          <DialogDescription>
            Share your decision analysis with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Copy Link Section */}
          <div className="space-y-2">
            <Label htmlFor="link">Share Link</Label>
            <div className="flex gap-2">
              <Input
                id="link"
                value={shareUrl}
                readOnly
                className="flex-1"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Native Share (Mobile) */}
          {navigator.share && (
            <Button
              onClick={handleNativeShare}
              variant="outline"
              className="w-full gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share via...
            </Button>
          )}

          {/* Social Media Buttons */}
          <div className="space-y-2">
            <Label>Share on Social Media</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleTwitterShare}
                variant="outline"
                className="gap-2"
              >
                <Twitter className="h-4 w-4" />
                Twitter
              </Button>
              <Button
                onClick={handleLinkedInShare}
                variant="outline"
                className="gap-2"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </Button>
              <Button
                onClick={handleFacebookShare}
                variant="outline"
                className="gap-2"
              >
                <Facebook className="h-4 w-4" />
                Facebook
              </Button>
              <Button
                onClick={handleWhatsAppShare}
                variant="outline"
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Email Share */}
          <Button
            onClick={handleEmailShare}
            variant="outline"
            className="w-full gap-2"
          >
            <Mail className="h-4 w-4" />
            Share via Email
          </Button>

          {/* Summary Preview */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Share Preview:</p>
            <p className="text-sm text-muted-foreground">{shareText}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
