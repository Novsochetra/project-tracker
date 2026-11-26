import * as Icons from 'lucide-react';
import { useState } from 'react';
import { DemoSection } from './DemoSection';
import { caption, mono, paper, row, titleText } from './demoStyles';
import * as Gallery from './galleryComponents';

const DELETE_PROJECT = "Delete this project and its 8 tickets? This can't be undone.";

function OptionsMenu() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  const toggle = () => setOpen(!open);
  const trigger = (
    <Gallery.IconButton
      aria-label="Options"
      aria-expanded={open}
      icon={Icons.Ellipsis}
      onClick={toggle}
    />
  );
  const confirm = (
    <Gallery.ConfirmCard
      variant="menu"
      message={DELETE_PROJECT}
      onCancel={close}
      onConfirm={close}
    />
  );

  return (
    <Gallery.Popover open={open} onClose={close} aria-label="Project options" trigger={trigger}>
      {confirming ? (
        confirm
      ) : (
        <>
          <Gallery.MenuItem icon={Icons.PenLine} onClick={close}>
            Edit project
          </Gallery.MenuItem>
          <Gallery.MenuItem icon={Icons.Trash2} tone="danger" onClick={() => setConfirming(true)}>
            Delete project
          </Gallery.MenuItem>
        </>
      )}
    </Gallery.Popover>
  );
}

function ConfirmDemo() {
  const [deleting, setDeleting] = useState(false);
  const done = () => setDeleting(false);
  const message = "Delete MOB-3? This can't be undone.";
  if (deleting) return <Gallery.ConfirmCard message={message} onCancel={done} onConfirm={done} />;

  return (
    <Gallery.Button
      variant="text"
      tone="danger"
      icon={Icons.Trash2}
      onClick={() => setDeleting(true)}
    >
      Delete ticket
    </Gallery.Button>
  );
}

export function StatesDemo() {
  const action = <Gallery.Button variant="primary">New project</Gallery.Button>;

  return (
    <DemoSection title="Menu, confirm, empty states">
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <ConfirmDemo />
        <OptionsMenu />
      </div>
      <Gallery.EmptyState bordered icon={Icons.Folder} title="No projects yet" action={action} />
      <Gallery.EmptyState
        icon={Icons.Plus}
        title="No tickets yet"
        text="Create the first ticket."
      />
    </DemoSection>
  );
}

export function TextDemo() {
  return (
    <DemoSection title="Growing text">
      <div style={paper}>
        <span style={mono}>MOB-3</span>
        <Gallery.AutoTextarea
          variant="inline"
          aria-label="Title"
          defaultValue="Crash"
          style={titleText}
        />
        <Gallery.AutoTextarea
          variant="inline"
          aria-label="Description"
          placeholder="Add details…"
        />
        <Gallery.AutoTextarea aria-label="Comment" placeholder="Leave a comment…" />
      </div>
    </DemoSection>
  );
}

export function ToastDemo() {
  const toast = Gallery.useToast();
  const [raised, setRaised] = useState(false);
  Gallery.useToastRaise(raised);

  return (
    <DemoSection title="Toast">
      <div style={row}>
        <Gallery.Button onClick={() => toast.show('MOB-7 created')}>Show toast</Gallery.Button>
        <Gallery.Button onClick={() => toast.show('Report applied to 2 tickets')}>
          Replace it
        </Gallery.Button>
        <Gallery.Switch
          checked={raised}
          onChange={setRaised}
          aria-label="Raise above the phone bar"
        />
        <span style={caption}>Raise above the phone bar</span>
      </div>
    </DemoSection>
  );
}
