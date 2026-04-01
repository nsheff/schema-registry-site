import { Link } from 'react-router-dom';

interface TypeLinkProps {
  name: string;
  rangeType?: 'class' | 'enum' | 'type';
  multivalued?: boolean;
  basePath: string; // e.g. "/fairtracks/fga/0.1.0"
}

export function TypeLink({ name, rangeType, multivalued, basePath }: TypeLinkProps) {
  let content: React.ReactNode;

  if (rangeType === 'class') {
    content = <Link to={`${basePath}/class/${name}`} className="linkml-type linkml-type-class">{name}</Link>;
  } else if (rangeType === 'enum') {
    content = <Link to={`${basePath}/enum/${name}`} className="linkml-type linkml-type-enum">{name}</Link>;
  } else {
    content = <span className="linkml-type linkml-type-primitive">{name}</span>;
  }

  if (multivalued) {
    return <span>{content}<span className="linkml-multivalued">[]</span></span>;
  }

  return content;
}
