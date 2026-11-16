import { ListGroup, type ListGroupProps } from "react-bootstrap";
import "./List.css";

function ListSurface({ className = "", ...props }: ListGroupProps) {
  return <ListGroup {...props} className={`ds-list ${className}`} />;
}

export const List = Object.assign(ListSurface, { Item: ListGroup.Item });
