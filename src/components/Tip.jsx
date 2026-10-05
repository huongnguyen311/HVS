import { cloneElement, useState } from 'react';
import { Button, ConfigProvider, Modal, Popover } from 'antd';

// Tooltips show at once: the zoom-in also threw off where the popover lands on its first open.
const still = { token: { motion: false } };

// Details of a board mark. Desktop (body.desk): a hover tooltip, with the optional { label, onClick } action
// button inside it; the child's own click keeps working. Phone (no hover): a tap opens the content in a small
// modal instead, unless the child has its own click (that action is what the tip explained).
// desk: a hover card on desktop only; the phone keeps the bare cell (its tap does what it always did).
export default function Tip({ title, content, action, desk = false, children }) {
  const [open, setOpen] = useState(false);
  if (!content) return children;
  const close = () => setOpen(false);
  const onDesk = document.body.classList.contains('desk');
  if (desk && !onDesk) return children;

  if (onDesk) {
    return (
      <ConfigProvider theme={still}>
        <Popover
          title={title}
          mouseEnterDelay={0.25}
          destroyOnHidden
          open={open}
          onOpenChange={setOpen}
          overlayClassName="tip-pop"
          content={
            <div onClick={(e) => e.stopPropagation()}>
              <div className="tip-body">{content}</div>
              {action && (
                <Button
                  type="primary"
                  size="small"
                  className="tip-act"
                  onClick={() => {
                    close();
                    action.onClick();
                  }}
                >
                  {action.label}
                </Button>
              )}
            </div>
          }
        >
          {children}
        </Popover>
      </ConfigProvider>
    );
  }

  if (children.props.onClick) return children;
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
