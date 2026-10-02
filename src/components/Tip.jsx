import { cloneElement, useState } from 'react';
import { Button, Modal } from 'antd';

// Tap-to-open replacement for a hover tooltip: the board runs on a phone, where hover never fires.
// A child with its own click keeps it (that action is what the tip explained); otherwise a tap opens the
// content in a small modal, with an optional { label, onClick } action button under it.
export default function Tip({ title, content, action, children }) {
  const [open, setOpen] = useState(false);
  if (!content || children.props.onClick) return children;
  const close = () => setOpen(false);
  return (
    <>
      {cloneElement(children, {
        className: (children.props.className ? children.props.className + ' ' : '') + 'tip-tap',
        onClick: (e) => {
          e.stopPropagation();
          setOpen(true);
        }
      })}
      {/* React events bubble out of the portal to the cell / row; stop them here. */}
      <span hidden onClick={(e) => e.stopPropagation()}>
        <Modal
          open={open}
          title={title}
          centered
          width={320}
          destroyOnHidden
          onCancel={close}
          footer={
            action ? (
              <Button
                type="primary"
                onClick={() => {
                  close();
                  action.onClick();
                }}
              >
                {action.label}
              </Button>
            ) : null
          }
        >
          <div className="tip-body">{content}</div>
        </Modal>
      </span>
    </>
  );
}
