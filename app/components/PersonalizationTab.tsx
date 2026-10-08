"use client";

import { ChevronRight, Sun, Moon, Laptop } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTheme } from "next-themes";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SubscriptionTier } from "@/types";

interface PersonalizationTabProps {
  onCustomInstructions: () => void;
  onManageNotes: () => void;
  subscription?: SubscriptionTier;
}

const PersonalizationTab = ({
  onCustomInstructions,
  onManageNotes,
  subscription,
}: PersonalizationTabProps) => {
  const { theme, setTheme } = useTheme();
  const userCustomization = useQuery(
    api.userCustomization.getUserCustomization,
    {},
  );
  const saveCustomization = useMutation(
    api.userCustomization.saveUserCustomization,
  );

  return (
    <div className="space-y-6">
      {/* Theme / Appearance Section */}
      <div>
        <h3 className="text-lg font-medium mb-4 pb-2 border-b">Appearance</h3>
        <div className="flex items-center justify-between py-3 border-b">
          <div>
            <div className="font-medium">Theme</div>
            <div className="text-sm text-muted-foreground">
              Choose your preferred interface theme.
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer",
                theme === "light"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer",
                theme === "dark"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer",
                theme === "system"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Laptop className="h-3.5 w-3.5" />
              System
            </button>
          </div>
        </div>
      </div>

      {/* Personalization Section */}
      <div>
        <h3 className="text-lg font-medium mb-4 pb-2 border-b">
          Customization
        </h3>
        <div className="space-y-4">
          <div
            className="flex items-center justify-between py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors rounded-md px-2 -mx-2"
            onClick={onCustomInstructions}
          >
            <div>
              <div className="font-medium">Custom instructions</div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Configure
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      {subscription && (
        <div>
          <h3 className="text-lg font-medium mb-4 pb-2 border-b">Notes</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <div className="font-medium">Enable notes</div>
                <div className="text-sm text-muted-foreground">
                  Let DoNoHarm save and use notes when responding.
                </div>
              </div>
              <Switch
                checked={userCustomization?.include_notes ?? true}
                onCheckedChange={async (checked) => {
                  try {
                    await saveCustomization({
                      include_notes: checked,
                    });
                  } catch (error) {
                    console.error("Failed to save customization:", error);
                    const errorMessage =
                      error instanceof ConvexError
                        ? (error.data as { message?: string })?.message ||
                          error.message ||
                          "Failed to save customization"
                        : error instanceof Error
                          ? error.message
                          : "Failed to save customization";
                    toast.error(errorMessage);
                  }
                }}
                aria-label="Toggle notes"
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">Manage notes</div>
              </div>
              <Button variant="outline" size="sm" onClick={onManageNotes}>
                Manage
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { PersonalizationTab };
