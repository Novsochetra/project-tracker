import { ComponentsDemo } from './componentsDemo';
import { GesturesDemo } from './gesturesDemo';

export default function Gallery() {
  return (
    <div className="dev-gallery">
      <ComponentsDemo />
      <GesturesDemo />
    </div>
  );
}
