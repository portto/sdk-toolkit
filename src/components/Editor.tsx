import React, { useCallback, useState } from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  Tab,
  TabList,
  Tabs,
  Textarea,
  Switch,
  useToast,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Select,
} from "@chakra-ui/react";
import * as fcl from "@blocto/fcl";
import * as types from "@onflow/types";
import ScriptTypes from "../types/ScriptTypes";
import { AddIcon, CloseIcon } from "@chakra-ui/icons";
import { ReactJSXElement } from "@emotion/react/types/jsx-namespace";

interface FlowArg {
  value: any;
  type: any;
}

const Editor = (): ReactJSXElement => {
  const toast = useToast();
  const [shouldSign, setShouldSign] = useState<boolean>();
  const [args, setArgs] = useState<FlowArg[]>();
  const [scriptType, setScriptType] = useState<ScriptTypes>(ScriptTypes.SCRIPT);
  const [script, setScript] = useState<string>("");
  const [response, setResponse] = useState<any>(undefined);
  const [result, setResult] = useState<string>("");

  const typeKeys = Object.keys(types);

  const runScript = useCallback(async () => {
    setResponse("");
    setResult("");
    const fclArgs = args?.map(({ value, type }) => {
      if (type.includes("Int")) {
        value = parseInt(value);
      } else if (type.includes("Fix")) {
        value = parseFloat(value).toFixed(8);
      } else if (type === "Boolean") {
        value = JSON.parse(value);
      }
      return fcl.arg(value, types[type]);
    });
    if (scriptType === ScriptTypes.SCRIPT) {
      fcl
        .send([fcl.script(script), fcl.args(fclArgs)])
        .then(fcl.decode)
        .then(setResult)
        .catch((e: Error) => {
          setResult(e.message);
        });
    } else {
      const block = await fcl.send([fcl.getLatestBlock()]).then(fcl.decode);
      try {
        const params = [
          fcl.args(fclArgs),
          fcl.proposer(fcl.currentUser().authorization),
          fcl.payer(fcl.currentUser().authorization),
          fcl.ref(block.id),
          fcl.limit(100),
        ];
        if (shouldSign)
          params.push(fcl.authorizations([fcl.currentUser().authorization]));

        const { transactionId } = await fcl.send([
          fcl.transaction(script),
          ...params,
        ]);

        toast({
          title: "Transaction sent, waiting for confirmation",
          status: "success",
          isClosable: true,
          duration: 1000,
        });

        const unsub = fcl
          .tx({ transactionId })
          .subscribe((transaction: any) => {
            if (transaction != response) setResponse(transaction);

            if (fcl.tx.isSealed(transaction)) {
              toast({
                title: "Transaction is Sealed",
                status: "success",
                isClosable: true,
                duration: 1000,
              });
              unsub();
            }
          });
      } catch (error) {
        console.error(error);
        toast({
          title: "Transaction failed",
          status: "error",
          isClosable: true,
          duration: 1000,
        });
      }
    }
  }, [toast, scriptType, script, response, shouldSign, args]);

  return (
    <Container p={2} mt={3} border="1px solid #e3e3e3" borderRadius={8}>
      <form>
        <Tabs variant="solid-rounded" size="sm" mb={3} onChange={setScriptType}>
          <TabList>
            <Tab>Script</Tab>
            <Tab>Transaction</Tab>
          </TabList>
        </Tabs>
        <Textarea
          rows={10}
          onChange={(e) => setScript(e.target.value)}
          value={script}
          fontFamily="monospace"
        />
        <Flex align="center" mt={3} ml={1}>
          <Box fontWeight="bold">Args</Box>
          <IconButton
            ml={2}
            aria-label="Add Args"
            isRound
            icon={<AddIcon />}
            size="xs"
            colorScheme="blue"
            onClick={() =>
              setArgs((args ?? []).concat({ value: "", type: "" }))
            }
          />
        </Flex>
        <Box mt={2}>
          {args?.map(({ value, type }, index) => (
            <Flex key={index} align="center" mt={2}>
              <Input
                value={value}
                onChange={(e) => {
                  const updated = args.slice();
                  updated.splice(index, 1, { type, value: e.target.value });
                  setArgs(updated);
                }}
                placeholder="value"
              />
              <Select
                onChange={(e) => {
                  const updated = args.slice();
                  updated.splice(index, 1, { value, type: e.target.value });
                  setArgs(updated);
                }}
                ml={2}
              >
                <option value="">--</option>
                {typeKeys.map((key) => (
                  <option value={key} key={key}>
                    {key}
                  </option>
                ))}
              </Select>
              <IconButton
                ml={2}
                aria-label="Delete Arg"
                isRound
                icon={<CloseIcon />}
                size="xs"
                colorScheme="red"
                onClick={() => {
                  const updated = args.slice();
                  updated.splice(index, 1);
                  setArgs(updated);
                }}
              />
            </Flex>
          ))}
        </Box>

        {(response || result) && (
          <Box ml={1}>
            <Box fontWeight="bold" mt={3}>
              {result ? "Run result:" : "Response:"}
            </Box>
            <Box
              borderRadius=".5em"
              bgColor="#d1e7dd"
              color="#0f5132"
              mt={1}
              p={3}
              whiteSpace="pre-wrap"
              maxHeight={240}
              overflow="auto"
            >
              {JSON.stringify(result || response, null, 2)}
            </Box>
          </Box>
        )}

        <Flex justify="end">
          {scriptType === ScriptTypes.TX && (
            <FormControl
              display="flex"
              justifyContent="end"
              alignItems="center"
              mt={2}
              mx={3}
            >
              <FormLabel htmlFor="shouldSign" mb="0">
                Authorize
              </FormLabel>
              <Switch
                id="shouldSign"
                isChecked={shouldSign}
                onChange={(e) => setShouldSign(e.target.checked)}
              />
            </FormControl>
          )}
          <Button onClick={runScript} mt={2}>
            run
          </Button>
        </Flex>
      </form>
    </Container>
  );
};

export default Editor;
