import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Notice } from '../../shared/ui/Notice';

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childName: string;
  /** "Thu 1 Oct, 17:00 to Thu 1 Oct, 19:00, London time." */
  change: string | undefined;
  pending: boolean;
  /** Why the last attempt failed, shown inside the dialog. */
  error: string | null;
  onConfirm: () => void;
}

/** "Move Leo's trial?" with the old and new time (doc 05 §6.4). */
export function MoveDialog({
  open,
  onOpenChange,
  childName,
  change,
  pending,
  error,
  onConfirm,
}: MoveDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={`Move ${childName}'s trial?`}
      description={change}
      actions={
        <>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Keep current time
          </Button>
          <Button pending={pending} onClick={onConfirm}>
            Move trial
          </Button>
        </>
      }
    >
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
    </Dialog>
  );
}
