import { kImages } from "@/util";
import { Painter } from "@/components";

export function generateStaticParams() {
  return kImages.map((_, index) => ({
    imageIndex: index.toString(),
  }));
}

export default async function Paint(props: {
  params: { imageIndex: string };
}): Promise<JSX.Element> {
  // fetch the current state from the server (this component is being rendered on a worker
  // so it does not have direct access to the server's state)
  const response = await fetch(
    `http://localhost${
      process.env.PORT ? `:${process.env.PORT}` : ""
    }/api/state?imageIndex=${props.params.imageIndex}`,
    { cache: "no-cache" }
  )
    .then((res) => res.json())
    .catch(() => ({
      state: [],
    }));

  const index = parseInt(props.params.imageIndex);

  return <Painter imageIndex={index} initialState={response.state} />;
}
